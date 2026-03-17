# ============================================================
# FILE: isud.py
#
# PURPOSE:
#   Provides a single generic CRUD router mounted at
#   `/api/v1/isud/{table_name}` that dynamically dispatches Insert,
#   Select, Update, and Delete operations against any SQLModel table
#   without needing a dedicated router per model.  It also hosts
#   inventory-image management endpoints and lightweight sync-check
#   helpers used by the frontend cache layer.
#
# FUNCTIONAL PARTS:
#   [1]  Imports                        — stdlib, third-party, and local imports
#   [2]  Constants                      — UPLOAD_DIR definition and directory creation
#   [3]  Read Schema Map                — READ_SCHEMA_MAP dict mapping table names
#                                         to their Pydantic read schemas
#   [4]  Serialization Helpers          — _serialize_record, _serialize_records
#   [5]  Model Discovery / Mapping      — _MODEL_MAPPING_CACHE, _build_model_mapping,
#                                         get_model_mapping, get_model_class
#   [6]  Router Definition              — APIRouter instantiation
#   [7]  Filter Coercion Helper         — _coerce_filter_value
#   [8]  Insert Endpoints               — POST /{table_name}/insert (multipart/JSON),
#                                         POST /{table_name} (JSON-only)
#   [9]  Update Endpoints               — PUT /{table_name}/{id}, PUT /{table_name}
#  [10]  Special Endpoints              — GET /inventory/locations,
#                                         GET /{table_name}/sync
#  [11]  Select Endpoints (GET)         — GET /{table_name}, GET /{table_name}/{id}
#  [12]  Delete Endpoint                — DELETE /{table_name}/{id}
#  [13]  Inventory Image Management     — POST/GET/PUT/DELETE /inventory/{id}/images/*,
#                                         GET /inventory/images/{id}/file
#
# CHANGE LOG — all modifications to this file must be recorded here:
#   Format : YYYY-MM-DD | Author | Description
#   ─────────────────────────────────────────────────────────────
#   2026-03-01 | Claude  | Added section comments and top-level documentation
#   2026-03-17 | GitHub Copilot | Fixed inventory image upload compatibility with legacy check constraints
# ============================================================

# ─── [1] IMPORTS ───────────────────────────────────────────────────────────────
import os
import inspect
import uuid as uuid_module
import jwt as pyjwt
from typing import Type, Dict, Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, Response
from starlette.datastructures import UploadFile as StarletteUploadFile
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from sqlmodel import SQLModel, select as sql_select

from ..database import get_session
from ..models import *
from .auth import get_current_user, get_current_company_id, get_user_permissions_list

# ─── [2] CONSTANTS ─────────────────────────────────────────────────────────────
# Upload dir for document file cleanup on delete (used when table is "document")
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Tables without company_id (system tables, never filter by company)
SYSTEM_TABLES = {"company", "database_connection", "document_blob", "schema_migration"}


def _resolve_permission_pages(table_name: str) -> set[str]:
    """Return candidate permission page names for a table endpoint."""
    base = (table_name or "").strip().lower()
    pages = {base}
    if base.endswith("s"):
        pages.add(base[:-1])
    else:
        pages.add(f"{base}s")
    if base in {"user", "users"}:
        pages.add("employees")
    return {p for p in pages if p}


def _require_isud_permission(
    current_user: User,
    session: Session,
    table_name: str,
    action: str,
) -> None:
    """Require page permission for non-admin users on generic ISUD endpoints."""
    if current_user.role == UserRole.ADMIN:
        return

    permissions = set(get_user_permissions_list(current_user, session))
    for page in _resolve_permission_pages(table_name):
        if f"{page}:{action}" in permissions or f"{page}:admin" in permissions:
            return

    raise HTTPException(status_code=403, detail=f"Missing permission: {table_name}:{action}")

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

# ─── [3] READ SCHEMA MAP (CONSTANTS) ──────────────────────────────────────────
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
    'service_recipe': ServiceRecipeRead,
    'service_recipes': ServiceRecipeRead,
    'product_resource': ProductResourceRead,
    'product_resources': ProductResourceRead,
    'product_asset': ProductAssetRead,
    'product_assets': ProductAssetRead,
    'product_location': ProductLocationRead,
    'product_locations': ProductLocationRead,
    'bundle_component': BundleComponentRead,
    'bundle_components': BundleComponentRead,
    'mix_config': MixConfigRead,
    'mix_component': MixComponentRead,
    'mix_components': MixComponentRead,
    'discount_rule': DiscountRuleRead,
    'discount_rules': DiscountRuleRead,
}

# ─── [4] SERIALIZATION HELPERS ────────────────────────────────────────────────
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
                    _image_to_read(img).model_dump(mode='json')
                    for img in images
                ]

                # Resolve supplier name from the FK
                if record.supplier_id:
                    supplier = session.get(Supplier, record.supplier_id)
                    record_dict['supplier_name'] = supplier.name if supplier else None
                else:
                    record_dict['supplier_name'] = None

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

# ─── [5] MODEL DISCOVERY / MAPPING HELPERS ────────────────────────────────────
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

# ─── [6] ROUTER DEFINITION ────────────────────────────────────────────────────
router = APIRouter()

# ─── [7] FILTER COERCION HELPER ───────────────────────────────────────────────
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

# ─── [8] INSERT ENDPOINTS ──────────────────────────────────────────────────────
@router.post("/{table_name}/insert")
async def insert_with_file(
    table_name: str,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Flexible insert endpoint that handles both JSON and multipart/form-data.
    When a file is included (for document uploads), it processes the file and
    extracts form fields. Otherwise, it parses JSON body.
    """
    model_class = get_model_class(table_name)
    _require_isud_permission(current_user, session, table_name, "write")
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

    # Special handling for user table: hash plain password into password_hash
    if table_name.lower() in ('user', 'users') and 'password' in record_data:
        plain_password = record_data.pop('password')
        if plain_password:
            record_data['password_hash'] = User.hash_password(plain_password)

    # Auto-inject company_id for tenant-scoped tables
    if table_name.lower() not in SYSTEM_TABLES and hasattr(model_class, 'company_id'):
        record_data['company_id'] = current_user.company_id or ""

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
    current_user: User = Depends(get_current_user),
):
    """Standard JSON insert endpoint."""
    model_class = get_model_class(table_name)
    _require_isud_permission(current_user, session, table_name, "write")

    # Special handling for user table: hash plain password into password_hash
    if table_name.lower() in ('user', 'users') and 'password' in record_data:
        plain_password = record_data.pop('password')
        if plain_password:
            record_data['password_hash'] = User.hash_password(plain_password)

    # Auto-inject company_id for tenant-scoped tables
    if table_name.lower() not in SYSTEM_TABLES and hasattr(model_class, 'company_id'):
        record_data['company_id'] = current_user.company_id or ""

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

    # ── P1-E: Decrement inventory stock when a product is sold ────────────────
    # Runs after the sale_transaction_item is committed so a failure here does
    # not roll back the sale itself — the sale is already persisted.
    if table_name.lower() in ('sale_transaction_item', 'sale_transaction_items'):
        item_type = getattr(record, 'item_type', None)
        item_id = getattr(record, 'item_id', None)
        qty_sold = getattr(record, 'quantity', 1) or 1

        def _consume_resources(product_id, units_sold: float):
            """Decrement resource inventory for each ProductResource linked to product_id."""
            try:
                res_links = session.exec(
                    sql_select(ProductResource).where(ProductResource.inventory_id == product_id)
                ).all()
                for pr in res_links:
                    res_inv = session.get(Inventory, pr.resource_id)
                    if res_inv is not None:
                        res_inv.quantity = max(0, (res_inv.quantity or 0) - (pr.quantity_per_batch * units_sold))
                        session.add(res_inv)
            except Exception as e:
                print(f"Warning: resource consumption failed for product {product_id}: {e}")

        if item_type == 'product' and item_id:
            try:
                inv = session.get(Inventory, item_id)
                if inv is not None:
                    inv.quantity = max(0, inv.quantity - qty_sold)
                    session.add(inv)
                _consume_resources(item_id, qty_sold)
                session.commit()
            except Exception as e:
                session.rollback()
                print(f"Warning: stock decrement failed for inventory {item_id}: {e}")

        elif item_type == 'mix' and item_id:
            # Decrement stock for each product the client picked × how many mixes were sold
            try:
                import json as _json
                raw = getattr(record, 'mix_selections', None)
                selections = _json.loads(raw) if raw else []
                for sel in selections:
                    pid = sel.get('product_id')
                    qty = int(sel.get('quantity', 0)) * qty_sold  # multiply by mixes sold
                    if pid and qty > 0:
                        comp_inv = session.get(Inventory, pid)
                        if comp_inv is not None:
                            comp_inv.quantity = max(0, comp_inv.quantity - qty)
                            session.add(comp_inv)
                        _consume_resources(pid, qty)
                session.commit()
            except Exception as e:
                session.rollback()
                print(f"Warning: mix stock decrement failed for mix {item_id}: {e}")

        elif item_type == 'bundle' and item_id:
            # Decrement stock for each component product × qty_sold bundles
            try:
                components = session.exec(
                    sql_select(BundleComponent).where(BundleComponent.bundle_id == item_id)
                ).all()
                for comp in components:
                    comp_inv = session.get(Inventory, comp.component_id)
                    if comp_inv is not None and (comp_inv.type or '').lower() == 'product':
                        units = comp.quantity * qty_sold
                        comp_inv.quantity = max(0, comp_inv.quantity - units)
                        session.add(comp_inv)
                        _consume_resources(comp.component_id, units)
                session.commit()
            except Exception as e:
                session.rollback()
                print(f"Warning: bundle stock decrement failed for bundle {item_id}: {e}")

    return _serialize_record(record, table_name)

# ─── [9] UPDATE ENDPOINTS ──────────────────────────────────────────────────────
@router.put("/{table_name}/{record_id}")
async def update_by_id(
    table_name: str,
    record_id: UUID,
    record_data: Dict[str, Any],
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    model_class = get_model_class(table_name)
    _require_isud_permission(current_user, session, table_name, "write")

    stmt = sql_select(model_class).where(getattr(model_class, "id") == record_id)
    if table_name.lower() not in SYSTEM_TABLES and hasattr(model_class, 'company_id'):
        stmt = stmt.where(getattr(model_class, 'company_id') == current_user.company_id)
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


# ─── [10] SPECIAL ENDPOINTS ───────────────────────────────────────────────────
# ===== INVENTORY LOCATIONS ENDPOINT (must be before generic routes) =====

@router.get("/inventory/locations")
async def get_inventory_locations(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get all unique locations from inventory items"""
    try:
        # Query distinct locations from inventory table — always scoped to company
        result = session.execute(
            sql_select(Inventory.location).where(
                and_(Inventory.location.isnot(None), Inventory.company_id == current_user.company_id)
            ).distinct()
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
    current_user: User = Depends(get_current_user),
):
    """
    Return a lightweight summary (row count + latest created_at) so the
    frontend cache can decide whether an incremental fetch is needed.
    """
    model_class = get_model_class(table_name)
    _require_isud_permission(current_user, session, table_name, "read")

    base_stmt = sql_select(func.count()).select_from(model_class.__table__)
    if table_name.lower() not in SYSTEM_TABLES and hasattr(model_class, 'company_id'):
        base_stmt = base_stmt.where(getattr(model_class, 'company_id') == current_user.company_id)
    count_result = session.execute(base_stmt)
    total = count_result.scalar() or 0

    max_created_at = None
    if hasattr(model_class, "created_at"):
        max_stmt = sql_select(func.max(model_class.created_at))
        if table_name.lower() not in SYSTEM_TABLES and hasattr(model_class, 'company_id'):
            max_stmt = max_stmt.where(getattr(model_class, 'company_id') == current_user.company_id)
        max_result = session.execute(max_stmt)
        val = max_result.scalar()
        if val is not None:
            max_created_at = val.isoformat() if hasattr(val, "isoformat") else str(val)

    return {"count": total, "max_created_at": max_created_at}


# ─── [11] SELECT ENDPOINTS (GET) ──────────────────────────────────────────────
@router.get("/{table_name}")
async def select(
    table_name: str,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    model_class = get_model_class(table_name)
    _require_isud_permission(current_user, session, table_name, "read")

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

    # Auto-filter by company_id for tenant-scoped tables
    if table_name.lower() not in SYSTEM_TABLES and hasattr(model_class, 'company_id'):
        stmt = stmt.where(getattr(model_class, 'company_id') == current_user.company_id)

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
    current_user: User = Depends(get_current_user),
):
    model_class = get_model_class(table_name)
    _require_isud_permission(current_user, session, table_name, "read")

    stmt = sql_select(model_class).where(getattr(model_class, "id") == record_id)
    if table_name.lower() not in SYSTEM_TABLES and hasattr(model_class, 'company_id'):
        stmt = stmt.where(getattr(model_class, 'company_id') == current_user.company_id)
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
    current_user: User = Depends(get_current_user),
):
    model_class = get_model_class(table_name)
    _require_isud_permission(current_user, session, table_name, "write")

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
    if table_name.lower() not in SYSTEM_TABLES and hasattr(model_class, 'company_id'):
        stmt = stmt.where(getattr(model_class, 'company_id') == current_user.company_id)

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

# ─── [12] DELETE ENDPOINT ──────────────────────────────────────────────────────

def _cascade_delete(session: Session, table_name: str, record_id: UUID, record) -> None:
    """
    Remove or nullify all FK-dependent rows before deleting the parent record,
    so that no FK-constraint violation is raised.

    Rules:
    • Rows whose entire meaning is tied to the deleted parent  → delete them.
    • Rows that belong to another entity but reference this one via an optional FK
      → set that FK column to NULL so the row survives.
    • Shared/historical data (sale transactions, documents owned by others, etc.)
      → only nullify the reference, never delete the other entity.
    """
    tn = table_name.lower()

    def _del(model, **filters):
        """Delete all rows of `model` matching given column=value filters."""
        rows = session.exec(
            sql_select(model).where(
                and_(*[getattr(model, k) == v for k, v in filters.items()])
            )
        ).all()
        for r in rows:
            session.delete(r)

    def _null(model, filter_col: str, filter_val, null_col: str):
        """Set null_col = None on all rows of `model` where filter_col = filter_val."""
        rows = session.exec(
            sql_select(model).where(getattr(model, filter_col) == filter_val)
        ).all()
        for r in rows:
            setattr(r, null_col, None)
            session.add(r)

    # ── INVENTORY ────────────────────────────────────────────────────────────
    if tn == "inventory":
        iid = record_id
        # Owned sub-records: delete entirely
        _del(InventoryImage,              inventory_id=iid)
        _del(AssetUnit,                   inventory_id=iid)
        _del(InventoryFeature,            inventory_id=iid)
        _del(InventoryFeatureOptionData,  inventory_id=iid)
        # Cross-entity links: delete the *link* row, the service/product survives
        _del(ServiceResource,  inventory_id=iid)
        _del(ServiceAsset,     inventory_id=iid)
        _del(ServiceLocation,  inventory_id=iid)

    # ── SERVICE ──────────────────────────────────────────────────────────────
    elif tn == "service":
        sid = record_id
        _del(ServiceResource, service_id=sid)
        _del(ServiceAsset,    service_id=sid)
        _del(ServiceEmployee, service_id=sid)
        _del(ServiceLocation, service_id=sid)
        _del(ServiceRecipe,   service_id=sid)
        # Schedules/inventory keep their records but lose the service FK reference
        _null(Schedule,   "service_id", sid, "service_id")
        _null(Inventory,  "service_id", sid, "service_id")

    # ── CLIENT ───────────────────────────────────────────────────────────────
    elif tn in ("client", "clients"):
        cid = record_id
        _null(Schedule, "client_id", cid, "client_id")
        _del(ScheduleAttendee, client_id=cid)
        _del(ClientCartItem,   client_id=cid)
        _null(SaleTransaction, "client_id", cid, "client_id")

    # ── SCHEDULE ─────────────────────────────────────────────────────────────
    elif tn in ("schedule", "schedules"):
        scid = record_id
        _del(ScheduleAttendee,  schedule_id=scid)
        _del(ScheduleDocument,  schedule_id=scid)
        _null(Schedule,         "parent_schedule_id", scid, "parent_schedule_id")
        _null(SaleTransaction,  "schedule_id", scid, "schedule_id")

    # ── DOCUMENT ─────────────────────────────────────────────────────────────
    elif tn in ("document", "documents"):
        did = record_id
        # File cleanup is handled by the caller before this function
        _del(DocumentBlob,       document_id=did)
        _del(DocumentAssignment, document_id=did)
        _del(ScheduleDocument,   document_id=did)
        _null(ChatMessage, "document_id", did, "document_id")

    # ── USER / EMPLOYEE ──────────────────────────────────────────────────────
    elif tn in ("user", "users"):
        uid = record_id
        _del(UserPermission,    user_id=uid)
        _del(ScheduleAttendee,  user_id=uid)
        _del(Attendance,        user_id=uid)
        _del(LeaveRequest,      user_id=uid)
        _del(OnboardingRequest, user_id=uid)
        _del(OffboardingRequest, user_id=uid)
        _del(PaySlip,           employee_id=uid)
        # ChatMessage sender_id / receiver_id are NOT NULL — delete the messages
        _del(ChatMessage, sender_id=uid)
        _del(ChatMessage, receiver_id=uid)
        # Self-referential: clear reports_to for direct reports
        _null(User, "reports_to", uid, "reports_to")

    # ── SALE TRANSACTION ─────────────────────────────────────────────────────
    elif tn in ("sale_transaction",):
        _del(SaleTransactionItem, sale_transaction_id=record_id)

    # ── DESCRIPTIVE FEATURE ──────────────────────────────────────────────────
    elif tn in ("descriptive_feature",):
        _del(InventoryFeatureOptionData, feature_id=record_id)
        _del(InventoryFeature,           feature_id=record_id)
        _del(FeatureOption,              feature_id=record_id)

    # ── FEATURE OPTION ───────────────────────────────────────────────────────
    elif tn in ("feature_option",):
        _del(InventoryFeatureOptionData, option_id=record_id)

    # ── DOCUMENT CATEGORY ────────────────────────────────────────────────────
    elif tn in ("document_category",):
        _null(Document, "category_id", record_id, "category_id")


@router.delete("/{table_name}/{record_id}")
async def delete_by_id(
    table_name: str,
    record_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    model_class = get_model_class(table_name)
    _require_isud_permission(current_user, session, table_name, "delete")

    stmt = sql_select(model_class).where(getattr(model_class, "id") == record_id)
    if table_name.lower() not in SYSTEM_TABLES and hasattr(model_class, 'company_id'):
        stmt = stmt.where(getattr(model_class, 'company_id') == current_user.company_id)
    record = session.exec(stmt).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Record not found in {table_name}")

    # Remove file from disk before the DB transaction for document deletes
    if table_name.lower() in ("document", "documents"):
        if hasattr(record, "file_path") and record.file_path:
            path = _resolve_document_path(record.file_path, UPLOAD_DIR)
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass

    # Cascade-delete / nullify all FK-dependent rows first
    _cascade_delete(session, table_name, record_id, record)

    session.delete(record)
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
    return {"count": 1}


# ─── [13] INVENTORY IMAGE MANAGEMENT ENDPOINTS ────────────────────────────────
# ===== INVENTORY IMAGE MANAGEMENT ENDPOINTS =====

def _image_to_read(img: InventoryImage) -> InventoryImageRead:
    """Build InventoryImageRead from an ORM instance, setting has_file correctly."""
    return InventoryImageRead(
        id=img.id,
        inventory_id=img.inventory_id,
        image_url=img.image_url,
        file_path=img.file_path,
        file_name=img.file_name,
        mime_type=img.mime_type,
        has_file=(img.image_data is not None) or bool(img.file_path),
        is_primary=img.is_primary,
        sort_order=img.sort_order,
        created_at=img.created_at,
        updated_at=img.updated_at,
    )

@router.post("/inventory/{inventory_id}/images/url")
async def add_inventory_image_url(
    inventory_id: UUID,
    image_data: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Add an image URL to an inventory item"""
    # Verify inventory exists and belongs to user's company
    inventory = session.get(Inventory, inventory_id)
    if not inventory or (current_user.company_id and inventory.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    from sqlalchemy import func as sa_func, update as sa_update
    existing_count = session.exec(
        sql_select(sa_func.count()).select_from(InventoryImage).where(InventoryImage.inventory_id == inventory_id)
    ).one()

    image = InventoryImage(
        inventory_id=inventory_id,
        image_url=image_data.get("image_url"),
        is_primary=image_data.get("is_primary", existing_count == 0),
        sort_order=image_data.get("sort_order", existing_count),
        company_id=inventory.company_id,
    )

    if image.is_primary:
        session.execute(
            sa_update(InventoryImage)
            .where(InventoryImage.inventory_id == inventory_id)
            .values(is_primary=False)
        )
    
    session.add(image)
    session.commit()
    session.refresh(image)
    
    return _image_to_read(image)


@router.post("/inventory/{inventory_id}/images/upload")
async def upload_inventory_image_file(
    inventory_id: UUID,
    file: UploadFile,
    is_primary: bool = False,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Upload an image file for an inventory item. Bytes are stored directly in the database."""
    inventory = session.get(Inventory, inventory_id)
    if not inventory or (current_user.company_id and inventory.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Inventory item not found")

    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.")

    max_size_bytes = 5 * 1024 * 1024  # 5MB
    content = await file.read()
    if len(content) > max_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max 5MB. Current: {len(content) / 1024 / 1024:.1f}MB",
        )

    # COUNT only — avoids loading binary blobs of existing images into memory
    from sqlalchemy import func as sa_func
    existing_count = session.exec(
        sql_select(sa_func.count()).select_from(InventoryImage).where(InventoryImage.inventory_id == inventory_id)
    ).one()
    is_first = existing_count == 0

    image = InventoryImage(
        inventory_id=inventory_id,
        file_name=file.filename,
        mime_type=file.content_type,
        image_data=content,          # Store bytes in the database — survives redeployments
        # Legacy DBs may still enforce check_image_source requiring file_path when image_url is null.
        # Keep a non-null marker path for compatibility; actual bytes remain in image_data.
        file_path=f"db://inventory-image/{uuid_module.uuid4()}",
        is_primary=is_primary or is_first,
        sort_order=existing_count,
        company_id=inventory.company_id,
    )

    if image.is_primary:
        # Bulk-unset without loading binary blobs
        from sqlalchemy import update as sa_update
        session.execute(
            sa_update(InventoryImage)
            .where(InventoryImage.inventory_id == inventory_id)
            .values(is_primary=False)
        )

    session.add(image)
    session.commit()
    session.refresh(image)

    return _image_to_read(image)


@router.get("/inventory/{inventory_id}/images")
async def get_inventory_images(
    inventory_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get all images for an inventory item"""
    inventory = session.get(Inventory, inventory_id)
    if not inventory or (current_user.company_id and inventory.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Inventory item not found")

    stmt = sql_select(InventoryImage).where(
        and_(
            InventoryImage.inventory_id == inventory_id,
            # Keep compatibility with older rows where company_id may be null.
            (InventoryImage.company_id == inventory.company_id) | (InventoryImage.company_id.is_(None))
        )
    ).order_by(InventoryImage.sort_order)
    
    images = session.exec(stmt).all()
    return [_image_to_read(img) for img in images]


@router.put("/inventory/images/{image_id}")
async def update_inventory_image(
    image_id: UUID,
    image_data: InventoryImageUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update an inventory image"""
    image = session.get(InventoryImage, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    inventory = session.get(Inventory, image.inventory_id)
    if not inventory or (current_user.company_id and inventory.company_id != current_user.company_id):
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
    
    return _image_to_read(image)


@router.delete("/inventory/images/{image_id}")
async def delete_inventory_image(
    image_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete an inventory image"""
    image = session.get(InventoryImage, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    inventory = session.get(Inventory, image.inventory_id)
    if not inventory or (current_user.company_id and inventory.company_id != current_user.company_id):
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
    request: Request,
    token: Optional[str] = None,
    session: Session = Depends(get_session),
):
    """Serve an inventory image.

    Reads bytes from the database (image_data column) so images persist across
    redeployments. Falls back to disk (file_path) for legacy pre-migration records.
    Accepts auth via Authorization: Bearer header OR ?token=<jwt> query param.
    """
    raw_token = token
    if not raw_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            raw_token = auth_header[7:]
    if not raw_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    _secret = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    try:
        claims = pyjwt.decode(raw_token, _secret, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    image = session.get(InventoryImage, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    inventory = session.get(Inventory, image.inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    token_company_id = claims.get("company_id") if isinstance(claims, dict) else None
    if token_company_id and inventory.company_id != token_company_id:
        raise HTTPException(status_code=404, detail="Image not found")

    # Primary path: bytes stored in the database
    # Cast to bytes explicitly — psycopg2 may return memoryview for BYTEA columns
    if image.image_data is not None:
        media_type = image.mime_type or "image/jpeg"
        return Response(
            content=bytes(image.image_data),
            media_type=media_type,
            headers={"Cache-Control": "private, max-age=86400"},
        )

    # Legacy fallback: file stored on disk (pre-migration uploads)
    if image.file_path:
        path = _resolve_document_path(image.file_path, UPLOAD_DIR)
        if os.path.exists(path):
            return FileResponse(path, media_type=image.mime_type or None, filename=image.file_name)

    raise HTTPException(status_code=404, detail="Image data not found")