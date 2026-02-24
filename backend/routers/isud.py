import os
import inspect
import uuid as uuid_module
from typing import Type, Dict, Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from starlette.datastructures import UploadFile as StarletteUploadFile
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
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
    'schedule_attendee': ScheduleAttendeeRead,
    'schedule_attendees': ScheduleAttendeeRead,
    'document': DocumentRead,
    'documents': DocumentRead,
    'role': RoleRead,
    'roles': RoleRead,
    'role_permission': RolePermissionRead,
    'role_permissions': RolePermissionRead,
    'user_permission': UserPermissionRead,
    'user_permissions': UserPermissionRead,
    'app_settings': AppSettingsRead,
    'inventory_image': InventoryImageRead,
    'inventory_images': InventoryImageRead,
    'database_connection': DatabaseConnectionRead,
    'database_connections': DatabaseConnectionRead,
    'supplier': SupplierRead,
    'suppliers': SupplierRead,
    'attendance': AttendanceRead,
    'insurance_plan': InsurancePlanRead,
    'insurance_plans': InsurancePlanRead,
    'leave_request': LeaveRequestRead,
    'leave_requests': LeaveRequestRead,
    'onboarding_request': OnboardingRequestRead,
    'onboarding_requests': OnboardingRequestRead,
    'offboarding_request': OffboardingRequestRead,
    'offboarding_requests': OffboardingRequestRead,
    'sale_transaction': SaleTransactionRead,
    'sale_transactions': SaleTransactionRead,
    'sale_transaction_item': SaleTransactionItemRead,
    'sale_transaction_items': SaleTransactionItemRead,
    'service_resource': ServiceResourceRead,
    'service_resources': ServiceResourceRead,
    'service_asset': ServiceAssetRead,
    'service_assets': ServiceAssetRead,
    'service_employee': ServiceEmployeeRead,
    'service_employees': ServiceEmployeeRead,
    'service_location': ServiceLocationRead,
    'service_locations': ServiceLocationRead,
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
        uploaded_file: Optional[StarletteUploadFile] = None

        # Extract all form fields
        for key, value in form.items():
            if isinstance(value, StarletteUploadFile):
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

            # Read file contents
            contents = await uploaded_file.read()

            # Save file to disk (best-effort; DB blob is the authoritative copy)
            try:
                with open(file_path, "wb") as f:
                    f.write(contents)
            except OSError:
                file_path = unique_filename  # disk save failed; store filename only

            # Add file metadata to record
            record_data["filename"] = unique_filename
            record_data["original_filename"] = uploaded_file.filename or "unknown"
            record_data["file_path"] = file_path
            record_data["file_size"] = len(contents)
            record_data["content_type"] = uploaded_file.content_type or "application/octet-stream"

            # Store raw bytes for later (saved to DocumentBlob after commit)
            _file_bytes = contents
        else:
            _file_bytes = None
    else:
        # Handle JSON body
        try:
            record_data = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid request body")
        _file_bytes = None

    try:
        record = model_class(**record_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid data: {str(e)}")

    session.add(record)
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    session.refresh(record)

    # Serialize response BEFORE blob save (blob save may corrupt session state)
    result = _serialize_record(record, table_name, session)

    # Save file data to DocumentBlob table (separate from document metadata)
    if _file_bytes is not None:
        try:
            blob = DocumentBlob(document_id=record.id, data=_file_bytes)
            session.add(blob)
            session.commit()
        except Exception:
            session.rollback()

    return result

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
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
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

    if hasattr(record, "updated_at"):
        from datetime import datetime
        record.updated_at = datetime.utcnow()

    session.add(record)
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    session.refresh(record)
    return _serialize_record(record, table_name, session)


# ===== INVENTORY LOCATIONS ENDPOINT (must be before generic routes) =====

@router.get("/inventory/locations")
async def get_inventory_locations(
    session: Session = Depends(get_session)
):
    """Get all unique locations from inventory items"""
    try:
        # Query distinct locations from inventory table
        result = session.execute(
            sql_select(Inventory.location).where(Inventory.location.isnot(None)).distinct()
        )
        locations = [row[0] for row in result.fetchall() if row[0]]
        return {"locations": sorted(locations)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch locations: {str(e)}")


# ===== SYNC CHECK ENDPOINT (lightweight count + max timestamp) =====

@router.get("/{table_name}/sync")
async def sync_check(
    table_name: str,
    session: Session = Depends(get_session),
):
    """
    Return a lightweight summary (row count + latest created_at) so the
    frontend cache can decide whether an incremental fetch is needed.
    """
    model_class = get_model_class(table_name)

    count_result = session.execute(
        sql_select(func.count()).select_from(model_class.__table__)
    )
    total = count_result.scalar() or 0

    max_created_at = None
    if hasattr(model_class, "created_at"):
        max_result = session.execute(
            sql_select(func.max(model_class.created_at))
        )
        val = max_result.scalar()
        if val is not None:
            max_created_at = val.isoformat() if hasattr(val, "isoformat") else str(val)

    return {"count": total, "max_created_at": max_created_at}


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

    # ── Incremental fetch: _after=<ISO timestamp> ──────────────────
    # Returns only rows whose created_at > the supplied value.
    after_value = None
    user_filters = []
    for k, v in raw_filters:
        if k == "_after":
            after_value = v
        else:
            user_filters.append((k, v))

    if after_value and hasattr(model_class, "created_at"):
        stmt = stmt.where(model_class.created_at > after_value)

    conditions = []
    for column, raw_value in user_filters:
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

    if any(k == "id" for k, _ in user_filters):
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

    # When deleting a document, also remove the file from disk and the DB blob
    if table_name.lower() in ("document", "documents"):
        if hasattr(record, "file_path") and record.file_path:
            path = _resolve_document_path(record.file_path, UPLOAD_DIR)
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass
        # Remove associated DocumentBlob
        blob = session.exec(
            sql_select(DocumentBlob).where(DocumentBlob.document_id == record_id)
        ).first()
        if blob:
            session.delete(blob)

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