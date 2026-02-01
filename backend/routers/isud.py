import os
import inspect
import uuid as uuid_module
from typing import Type, Dict, Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import and_
from sqlmodel import SQLModel, select as sql_select

from ..database import get_session
from ..models import *

# Upload dir for document file cleanup on delete (used when table is "document")
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _resolve_document_path(file_path: str, upload_dir: str) -> str:
    """Resolve path for a document file (stored path or upload_dir + basename)."""
    if not file_path:
        return ""
    if os.path.isabs(file_path) and os.path.exists(file_path):
        return file_path
    fallback = os.path.join(upload_dir, os.path.basename(file_path))
    if os.path.exists(fallback):
        return fallback
    return file_path

# Mapping of table names to their safe Read schemas (to avoid relationship serialization issues)
READ_SCHEMA_MAP = {
    'client': ClientRead,
    'clients': ClientRead,
    'inventory': InventoryRead,
    'service': ServiceRead,
    'services': ServiceRead,
    'user': UserRead,
    'users': UserRead,
    'schedule': ScheduleRead,
    'schedules': ScheduleRead,
}


def _serialize_record(record, table_name: str):
    """Serialize a record using the appropriate Read schema if available."""
    if record is None:
        return None
        
    read_schema = READ_SCHEMA_MAP.get(table_name.lower())
    if read_schema:
        # Use from_orm_safe if available (for custom conversion logic)
        if hasattr(read_schema, 'from_orm_safe'):
            result = read_schema.from_orm_safe(record)
            # Convert to dict if it's a SQLModel instance
            if hasattr(result, 'model_dump'):
                return result.model_dump(mode='json')
            return result
        # Otherwise use model_validate with from_attributes
        try:
            validated = read_schema.model_validate(record)
            # CRITICAL: Convert to dict so all fields are included and relationships excluded
            if hasattr(validated, 'model_dump'):
                return validated.model_dump(mode='json')
            return validated
        except Exception as e:
            # Fallback: use model_dump directly with relationship exclusion
            if hasattr(record, 'model_dump'):
                return record.model_dump(mode='json', exclude={'supplier', 'inventory_items', 'schedules'})
            raise
    
    # No schema - use model_dump directly with relationship exclusion
    if hasattr(record, 'model_dump'):
        return record.model_dump(mode='json', exclude={'supplier', 'inventory_items', 'schedules'})
    return record


def _serialize_records(records, table_name: str):
    """Serialize multiple records using the appropriate Read schema."""
    if not records:
        return []
        
    read_schema = READ_SCHEMA_MAP.get(table_name.lower())
    if read_schema:
        if hasattr(read_schema, 'from_orm_safe'):
            results = [read_schema.from_orm_safe(r) for r in records]
            return [(r.model_dump(mode='json') if hasattr(r, 'model_dump') else r) for r in results]
        try:
            validated_list = [read_schema.model_validate(r) for r in records]
            return [(v.model_dump(mode='json') if hasattr(v, 'model_dump') else v) for v in validated_list]
        except Exception:
            return [(r.model_dump(mode='json', exclude={'supplier', 'inventory_items', 'schedules'}) if hasattr(r, 'model_dump') else r) for r in records]
    
    # No schema - use model_dump directly with relationship exclusion
    return [(r.model_dump(mode='json', exclude={'supplier', 'inventory_items', 'schedules'}) if hasattr(r, 'model_dump') else r) for r in records]

# In-memory cache for model mapping
_MODEL_MAPPING_CACHE: Optional[Dict[str, Type[SQLModel]]] = None

def _build_model_mapping() -> Dict[str, Type[SQLModel]]:
    """Dynamically discover all SQLModel table classes from models module."""
    mapping = {}
    
    # Get all classes from the models module
    models_module = __import__('backend.models', fromlist=[''])
    
    for name, obj in inspect.getmembers(models_module, inspect.isclass):
        # Check if it's a SQLModel subclass with table=True
        if (issubclass(obj, SQLModel) and 
            obj != SQLModel and 
            obj != BaseModel and
            hasattr(obj, '__table__') and 
            obj.__table__ is not None):
            
            # Use the actual table name from SQLModel metadata
            table_name = obj.__table__.name.lower()
            mapping[table_name] = obj
            
            # Also add pluralized version for convenience (e.g., "user" -> "users")
            # Simple pluralization for common cases
            if not table_name.endswith('s'):
                plural_name = table_name + 's'
                if plural_name not in mapping:  # Don't override if already exists
                    mapping[plural_name] = obj
    
    return mapping

def get_model_mapping() -> Dict[str, Type[SQLModel]]:
    """Get model mapping, building it dynamically if not cached."""
    global _MODEL_MAPPING_CACHE
    if _MODEL_MAPPING_CACHE is None:
        _MODEL_MAPPING_CACHE = _build_model_mapping()
    return _MODEL_MAPPING_CACHE

def get_model_class(table_name: str) -> Type[SQLModel]:
    """Get model class for a table name, raising error if not found."""
    mapping = get_model_mapping()
    if table_name not in mapping:
        raise HTTPException(
            status_code=404, 
            detail=f"Table '{table_name}' not found. Available tables: {list(mapping.keys())}"
        )
    return mapping[table_name]

router = APIRouter()

def _coerce_filter_value(model_class: Type[SQLModel], column: str, raw_value: str) -> Any:
    field_info = model_class.model_fields.get(column)
    if field_info is None:
        return raw_value

    annotation = field_info.annotation

    if annotation is UUID:
        return UUID(raw_value)
    if annotation is int:
        return int(raw_value)
    if annotation is float:
        return float(raw_value)
    if annotation is bool:
        lowered = raw_value.lower()
        if lowered in {"true", "1", "yes", "y", "t"}:
            return True
        if lowered in {"false", "0", "no", "n", "f"}:
            return False
        return bool(raw_value)

    return raw_value

@router.post("/{table_name}/insert")
async def insert_with_file(
    table_name: str,
    request: Request,
    session: Session = Depends(get_session),
):
    """
    Flexible insert endpoint that handles both JSON and multipart/form-data.
    When a file is included (for document uploads), it processes the file and
    extracts form fields. Otherwise, it parses JSON body.
    """
    model_class = get_model_class(table_name)
    record_data: Dict[str, Any] = {}

    content_type = request.headers.get("content-type", "")

    if "multipart/form-data" in content_type:
        # Handle multipart form data (file uploads)
        form = await request.form()
        uploaded_file: Optional[UploadFile] = None

        # Extract all form fields
        for key, value in form.items():
            if isinstance(value, UploadFile):
                # Store the file for processing
                if key == "file":
                    uploaded_file = value
            else:
                # Convert empty strings to None for optional fields
                if value == "" or value == "null" or value == "undefined":
                    record_data[key] = None
                else:
                    record_data[key] = value

        # Handle file upload for document table
        if uploaded_file and table_name.lower() in ("document", "documents"):
            # Generate unique filename
            file_ext = os.path.splitext(uploaded_file.filename or "")[1]
            unique_filename = f"{uuid_module.uuid4()}{file_ext}"
            file_path = os.path.join(UPLOAD_DIR, unique_filename)

            # Save file to disk
            contents = await uploaded_file.read()
            with open(file_path, "wb") as f:
                f.write(contents)

            # Add file metadata to record
            record_data["filename"] = unique_filename
            record_data["original_filename"] = uploaded_file.filename or "unknown"
            record_data["file_path"] = file_path
            record_data["file_size"] = len(contents)
            record_data["content_type"] = uploaded_file.content_type or "application/octet-stream"
    else:
        # Handle JSON body
        try:
            record_data = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid request body")

    try:
        record = model_class(**record_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid data: {str(e)}")

    session.add(record)
    session.commit()
    session.refresh(record)
    return _serialize_record(record, table_name)


@router.post("/{table_name}")
async def insert(
    table_name: str,
    record_data: Dict[str, Any],
    session: Session = Depends(get_session),
):
    """Standard JSON insert endpoint."""
    model_class = get_model_class(table_name)

    try:
        record = model_class(**record_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid data: {str(e)}")

    session.add(record)
    session.commit()
    session.refresh(record)
    return _serialize_record(record, table_name)


@router.put("/{table_name}/{record_id}")
async def update_by_id(
    table_name: str,
    record_id: UUID,
    record_data: Dict[str, Any],
    session: Session = Depends(get_session),
):
    model_class = get_model_class(table_name)

    stmt = sql_select(model_class).where(getattr(model_class, "id") == record_id)
    record = session.exec(stmt).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Record not found in {table_name}")

    for key, value in record_data.items():
        if hasattr(record, key) and key not in ["id", "created_at", "updated_at"]:
            setattr(record, key, value)

    session.add(record)
    session.commit()
    session.refresh(record)
    return _serialize_record(record, table_name)

@router.get("/{table_name}")
async def select(
    table_name: str,
    request: Request,
    session: Session = Depends(get_session),
):
    model_class = get_model_class(table_name)

    raw_filters = [(k, v) for k, v in request.query_params.multi_items()]
    if len(raw_filters) > 10:
        raise HTTPException(status_code=400, detail="A maximum of 10 filter parameters is allowed")

    stmt = sql_select(model_class)

    conditions = []
    for column, raw_value in raw_filters:
        if column not in model_class.model_fields:
            raise HTTPException(status_code=400, detail=f"Invalid filter column '{column}'")

        col_attr = getattr(model_class, column)

        if isinstance(raw_value, str) and "*" in raw_value:
            conditions.append(col_attr.like(raw_value.replace("*", "%")))
            continue

        value = _coerce_filter_value(model_class, column, raw_value)
        conditions.append(col_attr == value)

    if conditions:
        stmt = stmt.where(and_(*conditions))

    if any(k == "id" for k, _ in raw_filters):
        record = session.exec(stmt).first()
        if not record:
            raise HTTPException(status_code=404, detail=f"Record not found in {table_name}")
        return _serialize_record(record, table_name)

    records = session.exec(stmt).all()
    return _serialize_records(records, table_name)

@router.get("/{table_name}/{record_id}")
async def select_by_id(
    table_name: str,
    record_id: UUID,
    session: Session = Depends(get_session),
):
    model_class = get_model_class(table_name)

    stmt = sql_select(model_class).where(getattr(model_class, "id") == record_id)
    record = session.exec(stmt).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Record not found in {table_name}")
    return _serialize_record(record, table_name)


@router.put("/{table_name}")
async def update(
    table_name: str,
    request: Request,
    record_data: Dict[str, Any],
    session: Session = Depends(get_session),
):
    model_class = get_model_class(table_name)

    raw_filters = [(k, v) for k, v in request.query_params.multi_items()]
    if not raw_filters:
        raise HTTPException(status_code=400, detail="Update requires at least one filter (e.g., id=...)")
    if len(raw_filters) > 10:
        raise HTTPException(status_code=400, detail="A maximum of 10 filter parameters is allowed")

    stmt = sql_select(model_class)
    conditions = []
    for column, raw_value in raw_filters:
        if column not in model_class.model_fields:
            raise HTTPException(status_code=400, detail=f"Invalid filter column '{column}'")

        col_attr = getattr(model_class, column)

        if isinstance(raw_value, str) and "*" in raw_value:
            conditions.append(col_attr.like(raw_value.replace("*", "%")))
            continue

        value = _coerce_filter_value(model_class, column, raw_value)
        conditions.append(col_attr == value)

    stmt = stmt.where(and_(*conditions))

    update_many = not any(k == "id" for k, _ in raw_filters)

    if update_many:
        records = session.exec(stmt).all()
        if not records:
            raise HTTPException(status_code=404, detail=f"No matching records found in {table_name}")

        for record in records:
            for key, value in record_data.items():
                if hasattr(record, key) and key not in ["id", "created_at", "updated_at"]:
                    setattr(record, key, value)
            session.add(record)

        session.commit()
        return {"count": len(records)}

    record = session.exec(stmt).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Record not found in {table_name}")

    for key, value in record_data.items():
        if hasattr(record, key) and key not in ["id", "created_at", "updated_at"]:
            setattr(record, key, value)

    session.add(record)
    session.commit()
    session.refresh(record)
    return _serialize_record(record, table_name)


@router.delete("/{table_name}/{record_id}")
async def delete_by_id(
    table_name: str,
    record_id: UUID,
    session: Session = Depends(get_session),
):
    model_class = get_model_class(table_name)

    stmt = sql_select(model_class).where(getattr(model_class, "id") == record_id)
    record = session.exec(stmt).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Record not found in {table_name}")

    # When deleting a document, also remove the file from disk
    if table_name.lower() in ("document", "documents") and hasattr(record, "file_path") and record.file_path:
        path = _resolve_document_path(record.file_path, UPLOAD_DIR)
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass

    session.delete(record)
    session.commit()
    return {"count": 1}