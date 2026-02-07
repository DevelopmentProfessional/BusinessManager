import os
import inspect
import uuid as uuid_module
from typing import Type, Dict, Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
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
    'document': DocumentRead,
    'documents': DocumentRead,
    'document_assignment': DocumentAssignmentRead,
}

def _serialize_record(record, table_name: str, session=None):
    """Serialize a record using the appropriate Read schema if available."""
    if record is None:
        return None
        
    read_schema = READ_SCHEMA_MAP.get(table_name.lower())
    if read_schema:
        # Special handling for inventory to include images
        if table_name.lower() in ['inventory'] and session:
            try:
                # Load images for this inventory item
                images_stmt = sql_select(InventoryImage).where(
                    InventoryImage.inventory_id == record.id
                ).order_by(InventoryImage.sort_order)
                images = session.exec(images_stmt).all()
                
                # Convert record to dict and add images
                record_dict = record.model_dump() if hasattr(record, 'model_dump') else record.__dict__.copy()
                record_dict['images'] = [
                    InventoryImageRead.model_validate(img).model_dump(mode='json') 
                    for img in images
                ]
                
                # Create and return the read schema instance
                validated = read_schema.model_validate(record_dict)
                if hasattr(validated, 'model_dump'):
                    return validated.model_dump(mode='json')
                return validated
            except Exception as e:
                # Fallback to basic serialization if image loading fails
                print(f"Warning: Failed to load images for inventory {record.id}: {e}")
        
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

def _serialize_records(records, table_name: str, session=None):
    """Serialize multiple records using the appropriate Read schema."""
    if not records:
        return []
        
    # Special handling for inventory to include images
    if table_name.lower() in ['inventory'] and session:
        return [_serialize_record(record, table_name, session) for record in records]
        
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

# ============================================================================
# Schema/Metadata Endpoints
# ============================================================================

@router.get("/schema/tables")
async def get_available_tables():
    """Get list of all available database tables."""
    mapping = get_model_mapping()
    tables = []
    for table_name, model_class in mapping.items():
        tables.append({
            "name": table_name,
            "display_name": table_name.replace("_", " ").title()
        })
    return sorted(tables, key=lambda x: x["name"])

@router.get("/schema/tables/{table_name}/columns")
async def get_table_columns(table_name: str):
    """Get column information for a specific table."""
    model_class = get_model_class(table_name)
    columns = []
    
    for field_name, field_info in model_class.model_fields.items():
        # Skip auto-generated fields like id, created_at, updated_at for import
        is_auto = field_name in ['id', 'created_at', 'updated_at']
        
        # Get type annotation as string
        annotation = field_info.annotation
        type_name = str(annotation) if annotation else "string"
        if hasattr(annotation, "__name__"):
            type_name = annotation.__name__
        elif hasattr(annotation, "__origin__"):
            type_name = str(annotation.__origin__.__name__ if hasattr(annotation.__origin__, "__name__") else annotation)
        
        # Check if field is required (no default value)
        is_required = field_info.default is None and field_info.default_factory is None
        
        columns.append({
            "name": field_name,
            "display_name": field_name.replace("_", " ").title(),
            "type": type_name,
            "required": is_required and not is_auto,
            "auto_generated": is_auto
        })
    
    return columns

@router.post("/schema/tables/{table_name}/import")
async def bulk_import(
    table_name: str,
    records: List[Dict[str, Any]],
    session: Session = Depends(get_session),
):
    """Bulk import records into a table from CSV data."""
    model_class = get_model_class(table_name)
    
    # Get valid field names for this model
    valid_fields = set(model_class.model_fields.keys())
    # Remove auto-generated fields
    auto_fields = {'id', 'created_at', 'updated_at'}
    importable_fields = valid_fields - auto_fields
    
    imported_count = 0
    errors = []
    
    for idx, record_data in enumerate(records):
        try:
            # Sanitize input - replace dangerous characters
            sanitized_data = {}
            for key, value in record_data.items():
                # Normalize the key (lowercase, replace spaces with underscores)
                normalized_key = key.lower().strip().replace(" ", "_")
                
                # Skip if not a valid field
                if normalized_key not in importable_fields:
                    continue
                
                # Sanitize string values
                if isinstance(value, str):
                    # Replace characters that could break SQL or cause issues
                    value = value.replace("'", "''")  # Escape single quotes
                    value = value.replace("\\", "\\\\")  # Escape backslashes
                    value = value.strip()
                    
                    # Skip empty strings for non-string fields
                    if not value:
                        continue
                
                sanitized_data[normalized_key] = value
            
            # Skip empty records
            if not sanitized_data:
                continue
            
            # Create and insert the record
            new_record = model_class(**sanitized_data)
            session.add(new_record)
            imported_count += 1
            
        except Exception as e:
            errors.append({
                "row": idx + 1,
                "error": str(e),
                "data": record_data
            })
    
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Database error during import: {str(e)}")
    
    return {
        "success": True,
        "imported": imported_count,
        "total": len(records),
        "errors": errors[:10] if errors else []  # Return first 10 errors only
    }

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
            if hasattr(value, 'read') or isinstance(value, UploadFile):
                # Store the file for processing (check both duck-type and isinstance)
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

        # Document-specific type coercion for form fields (strings from FormData)
        if table_name.lower() in ("document", "documents"):
            for uuid_field in ("entity_id", "category_id", "owner_id"):
                val = record_data.get(uuid_field)
                if val is None or val in ("", "null", "undefined"):
                    record_data.pop(uuid_field, None)
                elif isinstance(val, str):
                    try:
                        record_data[uuid_field] = UUID(val)
                    except (ValueError, TypeError):
                        record_data.pop(uuid_field, None)
            # Coerce file_size to int if it came as a string
            fs = record_data.get("file_size")
            if isinstance(fs, str):
                try:
                    record_data["file_size"] = int(fs)
                except (ValueError, TypeError):
                    pass
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

    try:
        session.add(record)
        session.commit()
        session.refresh(record)
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return _serialize_record(record, table_name, session)

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
    return _serialize_record(record, table_name, session)

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
        return _serialize_record(record, table_name, session)

    records = session.exec(stmt).all()
    return _serialize_records(records, table_name, session)


def _serialize_records(records, table_name: str, session=None):
    """Serialize a list of records."""
    return [_serialize_record(record, table_name, session) for record in records]

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
    return _serialize_record(record, table_name, session)

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

    # When deleting a document, also remove the file from disk and clean up assignments
    if table_name.lower() in ("document", "documents"):
        if hasattr(record, "file_path") and record.file_path:
            path = _resolve_document_path(record.file_path, UPLOAD_DIR)
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass
        # Clean up document_assignment records before deleting the document
        try:
            assign_stmt = sql_select(DocumentAssignment).where(
                DocumentAssignment.document_id == record_id
            )
            for a in session.exec(assign_stmt).all():
                session.delete(a)
            session.flush()  # Flush assignment deletes before document delete
        except Exception:
            pass  # Table may not exist yet

    session.delete(record)
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
    return {"count": 1}


# ===== INVENTORY IMAGE MANAGEMENT ENDPOINTS =====

@router.post("/inventory/{inventory_id}/images/url")
async def add_inventory_image_url(
    inventory_id: UUID,
    image_data: dict,
    session: Session = Depends(get_session)
):
    """Add an image URL to an inventory item"""
    # Verify inventory exists
    inventory = session.get(Inventory, inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    # Get current image count to set sort order
    stmt = sql_select(InventoryImage).where(InventoryImage.inventory_id == inventory_id)
    existing_images = session.exec(stmt).all()
    
    # Create new image record
    image = InventoryImage(
        inventory_id=inventory_id,
        image_url=image_data.get("image_url"),
        is_primary=image_data.get("is_primary", len(existing_images) == 0),  # First image is primary
        sort_order=image_data.get("sort_order", len(existing_images))
    )
    
    # If this is set as primary, unset others
    if image.is_primary:
        for existing_image in existing_images:
            existing_image.is_primary = False
            session.add(existing_image)
    
    session.add(image)
    session.commit()
    session.refresh(image)
    
    return InventoryImageRead.model_validate(image)


@router.post("/inventory/{inventory_id}/images/upload")
async def upload_inventory_image_file(
    inventory_id: UUID,
    file: UploadFile,
    is_primary: bool = False,
    session: Session = Depends(get_session)
):
    """Upload an image file for an inventory item"""
    # Verify inventory exists
    inventory = session.get(Inventory, inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.")
    
    # Validate file size (max 5MB)
    max_size_bytes = 5 * 1024 * 1024  # 5MB
    content = await file.read()
    if len(content) > max_size_bytes:
        raise HTTPException(
            status_code=400, 
            detail=f"File size too large. Maximum allowed size is 5MB. Current file size: {len(content) / 1024 / 1024:.1f}MB"
        )
    
    # Reset file pointer for reading again
    await file.seek(0)
    
    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    unique_filename = f"inventory_{inventory_id}_{uuid_module.uuid4().hex}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Save file
    try:
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Get current image count for sort order
    stmt = sql_select(InventoryImage).where(InventoryImage.inventory_id == inventory_id)
    existing_images = session.exec(stmt).all()
    
    # Create new image record
    image = InventoryImage(
        inventory_id=inventory_id,
        file_path=file_path,
        file_name=file.filename,
        is_primary=is_primary or len(existing_images) == 0,
        sort_order=len(existing_images)
    )
    
    # If this is set as primary, unset others
    if image.is_primary:
        for existing_image in existing_images:
            existing_image.is_primary = False
            session.add(existing_image)
    
    session.add(image)
    session.commit()
    session.refresh(image)
    
    return InventoryImageRead.model_validate(image)


@router.get("/inventory/{inventory_id}/images")
async def get_inventory_images(
    inventory_id: UUID,
    session: Session = Depends(get_session)
):
    """Get all images for an inventory item"""
    stmt = sql_select(InventoryImage).where(
        InventoryImage.inventory_id == inventory_id
    ).order_by(InventoryImage.sort_order)
    
    images = session.exec(stmt).all()
    return [InventoryImageRead.model_validate(img) for img in images]


@router.put("/inventory/images/{image_id}")
async def update_inventory_image(
    image_id: UUID,
    image_data: InventoryImageUpdate,
    session: Session = Depends(get_session)
):
    """Update an inventory image"""
    image = session.get(InventoryImage, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Update fields
    update_data = image_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(image, field, value)
    
    # If setting as primary, unset others for this inventory item
    if image_data.is_primary:
        stmt = sql_select(InventoryImage).where(
            and_(
                InventoryImage.inventory_id == image.inventory_id,
                InventoryImage.id != image_id
            )
        )
        other_images = session.exec(stmt).all()
        for other_image in other_images:
            other_image.is_primary = False
            session.add(other_image)
    
    session.add(image)
    session.commit()
    session.refresh(image)
    
    return InventoryImageRead.model_validate(image)


@router.delete("/inventory/images/{image_id}")
async def delete_inventory_image(
    image_id: UUID,
    session: Session = Depends(get_session)
):
    """Delete an inventory image"""
    image = session.get(InventoryImage, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Delete file if it exists
    if image.file_path and os.path.exists(image.file_path):
        try:
            os.remove(image.file_path)
        except OSError:
            pass
    
    session.delete(image)
    session.commit()
    
    return {"message": "Image deleted successfully"}


@router.get("/inventory/images/{image_id}/file")
async def serve_inventory_image_file(
    image_id: UUID,
    session: Session = Depends(get_session)
):
    """Serve an uploaded inventory image file"""
    image = session.get(InventoryImage, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    if not image.file_path:
        raise HTTPException(status_code=404, detail="No file associated with this image")

    path = _resolve_document_path(image.file_path, UPLOAD_DIR)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Image file not found on disk")

    return FileResponse(path, media_type=None, filename=image.file_name)