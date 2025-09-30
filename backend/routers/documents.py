from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import FileResponse
from sqlmodel import Session, select, SQLModel
from typing import List, Optional
from uuid import UUID
from database import get_session
from models import (
    Document,
    EntityType,
    DocumentUpdate,
    DocumentRead,
    DocumentHistory,
    DocumentHistoryRead,
    DocumentCategory,
    DocumentCategoryRead,
    DocumentCategoryCreate,
    DocumentCategoryUpdate,
    DocumentAssignment,
    DocumentAssignmentRead,
    DocumentAssignmentCreate,
)
import os
import shutil
from datetime import datetime
from sqlalchemy import text
import urllib.request

router = APIRouter()


def _normalize_entity_type(val) -> Optional[str]:
    if val is None:
        return None
    try:
        # Enum -> value; string -> lower
        if hasattr(val, "value"):
            return str(val.value).lower()
        return str(val).lower()
    except Exception:
        return None


def _coerce_uuid(val) -> Optional[UUID]:
    """Try to coerce any input into a UUID, else return None.
    This protects the response model from legacy bad data.
    """
    if val is None:
        return None
    try:
        return UUID(str(val))
    except Exception:
        return None


def _to_read_model(doc: Document) -> DocumentRead:
    return DocumentRead(
        id=doc.id,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        filename=doc.filename,
        original_filename=doc.original_filename,
        file_path=doc.file_path,
        file_size=doc.file_size,
        content_type=doc.content_type or 'application/octet-stream',
        entity_type=_normalize_entity_type(doc.entity_type),
        entity_id=_coerce_uuid(doc.entity_id),
        description=doc.description,
        is_signed=bool(doc.is_signed),
        signed_by=doc.signed_by,
        signed_at=doc.signed_at,
        owner_id=_coerce_uuid(getattr(doc, 'owner_id', None)),
        review_date=getattr(doc, 'review_date', None),
        category_id=_coerce_uuid(getattr(doc, 'category_id', None)),
    )


def _to_history_read_model(h: DocumentHistory) -> DocumentHistoryRead:
    return DocumentHistoryRead(
        id=h.id,
        created_at=h.created_at,
        version=h.version,
        file_path=h.file_path,
        file_size=h.file_size,
        content_type=h.content_type or 'application/octet-stream',
        note=h.note,
    )


def _to_assignment_read_model(a: DocumentAssignment) -> DocumentAssignmentRead:
    return DocumentAssignmentRead(
        id=a.id,
        created_at=a.created_at,
        document_id=a.document_id,
        user_id=a.user_id,
    )


def _infer_document_type(filename: str) -> str:
    """Map filename extension to OnlyOffice documentType."""
    ext = (os.path.splitext(filename or "")[1] or "").lower().lstrip('.')
    if ext in ("doc", "docx", "odt", "rtf"):
        return "word"
    if ext in ("xls", "xlsx", "ods", "csv"):
        return "cell"
    if ext in ("ppt", "pptx", "odp"):
        return "slide"
    return "word"

@router.get("/documents", response_model=List[DocumentRead])
async def get_documents(session: Session = Depends(get_session)):
    """Get all documents"""
    try:
        documents = session.exec(select(Document)).all()
        return [_to_read_model(d) for d in documents]
    except Exception:
        # Fallback to raw SQL to tolerate legacy rows with invalid enum values
        rows = session.exec(text(
            """
            SELECT id, created_at, updated_at, filename, original_filename, file_path,
                   file_size, content_type, entity_type, entity_id, description,
                   is_signed, signed_by, signed_at
            FROM document
            """
        )).all()
        result: List[DocumentRead] = []
        for r in rows:
            # Map positional row to named fields
            (
                _id, created_at, updated_at, filename, original_filename, file_path,
                file_size, content_type, entity_type, entity_id, description,
                is_signed, signed_by, signed_at
            ) = r
            try:
                dr = DocumentRead(
                    id=UUID(str(_id)),
                    created_at=created_at,
                    updated_at=updated_at,
                    filename=filename,
                    original_filename=original_filename,
                    file_path=file_path,
                    file_size=int(file_size) if file_size is not None else 0,
                    content_type=content_type or 'application/octet-stream',
                    entity_type=_normalize_entity_type(entity_type),
                    entity_id=_coerce_uuid(entity_id),
                    description=description,
                    is_signed=bool(int(is_signed)) if is_signed is not None else False,
                    signed_by=signed_by,
                    signed_at=signed_at,
                )
                result.append(dr)
            except Exception:
                # Skip any irreparably malformed row
                continue
        return result

@router.get("/documents/by-entity/{entity_type}/{entity_id}", response_model=List[DocumentRead])
async def get_entity_documents(
    entity_type: EntityType, 
    entity_id: UUID, 
    session: Session = Depends(get_session)
):
    """Get documents for a specific entity"""
    statement = select(Document).where(
        Document.entity_type == entity_type,
        Document.entity_id == entity_id
    )
    documents = session.exec(statement).all()
    return [_to_read_model(d) for d in documents]

    

@router.post("/documents", response_model=DocumentRead)
async def upload_document(
    description: Optional[str] = Form(default=None),
    file: UploadFile = File(...),
    entity_type: Optional[EntityType] = Form(default=None),
    entity_id: Optional[UUID] = Form(default=None),
    session: Session = Depends(get_session)
):
    """Upload a document, optionally linking it to an entity (e.g., item)."""
    # Create uploads directory if it doesn't exist
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)

    # Generate unique filename without entity reference
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    safe_original_name = os.path.basename(file.filename or "uploaded_file")
    unique_filename = f"{timestamp}_{safe_original_name}"
    file_path = os.path.join(upload_dir, unique_filename)

    # Save file
    try:
        file.file.seek(0)
    except Exception:
        pass
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create document record (entity fields may be set if provided)
    document = Document(
        filename=unique_filename,
        original_filename=file.filename,
        file_path=file_path,
        file_size=os.path.getsize(file_path),
        content_type=file.content_type or 'application/octet-stream',
        description=description,
        entity_type=entity_type,
        entity_id=entity_id,
    )

    session.add(document)
    session.commit()
    session.refresh(document)
    return _to_read_model(document)


# Replace document content and version previous file
@router.put("/documents/{document_id}/content", response_model=DocumentRead)
async def replace_document_content(
    document_id: UUID,
    file: UploadFile = File(...),
    note: Optional[str] = Form(default=None),
    session: Session = Depends(get_session),
):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Create history entry for current file before replacing
    current_max_version = session.exec(
        select(DocumentHistory.version).where(DocumentHistory.document_id == document_id)
    ).all()
    next_version = (max(current_max_version) if current_max_version else 0) + 1

    history = DocumentHistory(
        document_id=document_id,
        version=next_version,
        file_path=document.file_path,
        file_size=document.file_size,
        content_type=document.content_type or 'application/octet-stream',
        note=note,
    )
    session.add(history)
    session.commit()

    # Save new uploaded file as the latest document content
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    safe_original_name = os.path.basename(file.filename or "uploaded_file")
    unique_filename = f"{timestamp}_{safe_original_name}"
    new_file_path = os.path.join(upload_dir, unique_filename)
    try:
        file.file.seek(0)
    except Exception:
        pass
    with open(new_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    document.filename = unique_filename
    document.original_filename = file.filename or document.original_filename
    document.file_path = new_file_path
    document.file_size = os.path.getsize(new_file_path)
    document.content_type = file.content_type or document.content_type or 'application/octet-stream'
    document.updated_at = datetime.utcnow()

    session.add(document)
    session.commit()
    session.refresh(document)
    return _to_read_model(document)


# Get document history
@router.get("/documents/{document_id}/history", response_model=List[DocumentHistoryRead])
async def get_document_history(document_id: UUID, session: Session = Depends(get_session)):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    records = session.exec(
        select(DocumentHistory).where(DocumentHistory.document_id == document_id).order_by(DocumentHistory.version.desc())
    ).all()
    return [_to_history_read_model(h) for h in records]


# Categories CRUD
@router.get("/document-categories", response_model=List[DocumentCategoryRead])
async def list_document_categories(session: Session = Depends(get_session)):
    cats = session.exec(select(DocumentCategory)).all()
    return [DocumentCategoryRead(
        id=c.id, created_at=c.created_at, updated_at=c.updated_at, name=c.name, description=c.description
    ) for c in cats]


@router.post("/document-categories", response_model=DocumentCategoryRead)
async def create_document_category(payload: DocumentCategoryCreate, session: Session = Depends(get_session)):
    # Enforce unique name
    exists = session.exec(select(DocumentCategory).where(DocumentCategory.name == payload.name)).first()
    if exists:
        raise HTTPException(status_code=400, detail="Category name already exists")
    cat = DocumentCategory(name=payload.name, description=payload.description)
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return DocumentCategoryRead(id=cat.id, created_at=cat.created_at, updated_at=cat.updated_at, name=cat.name, description=cat.description)


@router.put("/document-categories/{category_id}", response_model=DocumentCategoryRead)
async def update_document_category(category_id: UUID, payload: DocumentCategoryUpdate, session: Session = Depends(get_session)):
    cat = session.get(DocumentCategory, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    if payload.name is not None:
        # Check uniqueness if name changes
        exists = session.exec(select(DocumentCategory).where(DocumentCategory.name == payload.name, DocumentCategory.id != category_id)).first()
        if exists:
            raise HTTPException(status_code=400, detail="Category name already exists")
        cat.name = payload.name
    if payload.description is not None:
        cat.description = payload.description
    cat.updated_at = datetime.utcnow()
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return DocumentCategoryRead(id=cat.id, created_at=cat.created_at, updated_at=cat.updated_at, name=cat.name, description=cat.description)


@router.delete("/document-categories/{category_id}")
async def delete_document_category(category_id: UUID, session: Session = Depends(get_session)):
    cat = session.get(DocumentCategory, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    # Null out references to this category
    session.exec(text("UPDATE document SET category_id = NULL WHERE category_id = :cid"), {"cid": str(category_id)})
    session.delete(cat)
    session.commit()
    return {"message": "Category deleted"}


# Assignments management
@router.get("/documents/{document_id}/assignments", response_model=List[DocumentAssignmentRead])
async def list_document_assignments(document_id: UUID, session: Session = Depends(get_session)):
    # ensure doc exists
    if not session.get(Document, document_id):
        raise HTTPException(status_code=404, detail="Document not found")
    rows = session.exec(select(DocumentAssignment).where(DocumentAssignment.document_id == document_id)).all()
    return [_to_assignment_read_model(a) for a in rows]


@router.post("/documents/{document_id}/assignments", response_model=DocumentAssignmentRead)
async def add_document_assignment(document_id: UUID, payload: DocumentAssignmentCreate, session: Session = Depends(get_session)):
    if not session.get(Document, document_id):
        raise HTTPException(status_code=404, detail="Document not found")
    # prevent duplicates
    existing = session.exec(select(DocumentAssignment).where(
        DocumentAssignment.document_id == document_id,
        DocumentAssignment.user_id == payload.user_id,
    )).first()
    if existing:
        return _to_assignment_read_model(existing)
    a = DocumentAssignment(document_id=document_id, user_id=payload.user_id)
    session.add(a)
    session.commit()
    session.refresh(a)
    return _to_assignment_read_model(a)


@router.delete("/documents/{document_id}/assignments/{user_id}")
async def remove_document_assignment(document_id: UUID, user_id: UUID, session: Session = Depends(get_session)):
    if not session.get(Document, document_id):
        raise HTTPException(status_code=404, detail="Document not found")
    a = session.exec(select(DocumentAssignment).where(
        DocumentAssignment.document_id == document_id,
        DocumentAssignment.user_id == user_id,
    )).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    session.delete(a)
    session.commit()
    return {"message": "Assignment removed"}


# OnlyOffice integration: provide editor config and save callback
@router.get("/documents/{document_id}/onlyoffice-config")
async def onlyoffice_config(document_id: UUID, request: Request, session: Session = Depends(get_session)):
    doc = session.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Ensure file exists
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    # Determine the externally reachable base URL for OnlyOffice server to access the backend.
    # Prefer env override to support containerized OnlyOffice (e.g., http://host.docker.internal:8000)
    env_base = os.getenv("ONLYOFFICE_PUBLIC_BASE_URL", "").strip()
    base = (env_base or str(request.base_url)).rstrip('/')
    file_url = f"{base}/api/v1/documents/{document_id}/download?download=true"
    callback_url = f"{base}/api/v1/onlyoffice/callback/{document_id}"

    # Unique key must change when file updates
    ts = int((doc.updated_at or doc.created_at or datetime.utcnow()).timestamp())
    key = f"{doc.id}-{ts}"

    filename = doc.original_filename or os.path.basename(doc.file_path)
    filetype = (os.path.splitext(filename)[1] or '').lstrip('.').lower() or 'docx'
    document_type = _infer_document_type(filename)

    return {
        "document": {
            "fileType": filetype,
            "key": key,
            "title": filename,
            "url": file_url,
            "permissions": {"edit": True, "download": True},
        },
        "documentType": document_type,
        "editorConfig": {
            "callbackUrl": callback_url,
            "mode": "edit",
            "lang": "en",
        },
        "height": "100%",
        "width": "100%",
        # The frontend loads the OnlyOffice script using VITE_ONLYOFFICE_URL
    }


@router.post("/onlyoffice/callback/{document_id}")
async def onlyoffice_callback(document_id: UUID, request: Request, session: Session = Depends(get_session)):
    """Receive save events from OnlyOffice and persist updated file.
    Respond with {"error": 0} on success per OnlyOffice protocol.
    """
    data = await request.json()
    status = int(data.get("status", 0))
    # Status 2: MustSave, 6: MustForceSave
    if status in (2, 6):
        download_url = data.get("url")
        if not download_url:
            return {"error": 1}
        doc = session.get(Document, document_id)
        if not doc:
            return {"error": 1}
        try:
            # Download updated file from Document Server and overwrite
            with urllib.request.urlopen(download_url) as resp, open(doc.file_path, "wb") as out:
                shutil.copyfileobj(resp, out)
            doc.file_size = os.path.getsize(doc.file_path)
            doc.updated_at = datetime.utcnow()
            session.add(doc)
            session.commit()
            return {"error": 0}
        except Exception:
            return {"error": 1}
    # Other statuses: acknowledge OK
    return {"error": 0}

@router.post("/documents/bulk", response_model=List[DocumentRead])
async def upload_documents_bulk(
    files: List[UploadFile] = File(...),
    description: Optional[str] = Form(default=None),
    entity_type: Optional[EntityType] = Form(default=None),
    entity_id: Optional[UUID] = Form(default=None),
    session: Session = Depends(get_session)
):
    """Upload multiple documents at once, optionally linking them to an entity."""
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)

    created: List[DocumentRead] = []
    for file in files:
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
        safe_original_name = os.path.basename(file.filename or "uploaded_file")
        unique_filename = f"{timestamp}_{safe_original_name}"
        file_path = os.path.join(upload_dir, unique_filename)

        try:
            file.file.seek(0)
        except Exception:
            pass
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        document = Document(
            filename=unique_filename,
            original_filename=file.filename,
            file_path=file_path,
            file_size=os.path.getsize(file_path),
            content_type=file.content_type or 'application/octet-stream',
            description=description,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        session.add(document)
        session.commit()
        session.refresh(document)
        created.append(_to_read_model(document))

    return created

@router.delete("/documents/{document_id}")
async def delete_document(document_id: UUID, session: Session = Depends(get_session)):
    """Delete a document"""
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete file from filesystem
    if os.path.exists(document.file_path):
        os.remove(document.file_path)
    
    session.delete(document)
    session.commit()
    return {"message": "Document deleted successfully"}

@router.get("/documents/{document_id}/download")
async def download_document(document_id: UUID, download: bool = False, session: Session = Depends(get_session)):
    """Serve the raw document file.
    - Inline by default for preview (images/PDFs render in browser).
    - If `download=true`, force attachment with filename.
    """
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if not os.path.exists(document.file_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    if download:
        # Force download with a friendly filename
        return FileResponse(
            path=document.file_path,
            media_type=document.content_type or 'application/octet-stream',
            filename=document.original_filename or os.path.basename(document.file_path),
        )

    # Inline preview (omit filename to avoid attachment disposition)
    return FileResponse(
        path=document.file_path,
        media_type=document.content_type or 'application/octet-stream',
    )

@router.get("/documents/history/{history_id}/download")
async def download_document_history(history_id: UUID, download: bool = False, session: Session = Depends(get_session)):
    """Serve a historical version file by history ID.
    - Inline by default for preview (images/PDFs render in browser).
    - If `download=true`, force attachment with a filename.
    """
    h = session.get(DocumentHistory, history_id)
    if not h:
        raise HTTPException(status_code=404, detail="History entry not found")

    if not os.path.exists(h.file_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    if download:
        return FileResponse(
            path=h.file_path,
            media_type=h.content_type or 'application/octet-stream',
            filename=os.path.basename(h.file_path),
        )

    return FileResponse(
        path=h.file_path,
        media_type=h.content_type or 'application/octet-stream',
    )

class DocumentSign(SQLModel):
    signed_by: str

@router.put("/documents/{document_id}", response_model=DocumentRead)
async def update_document(
    document_id: UUID,
    payload: DocumentUpdate,
    session: Session = Depends(get_session)
):
    """Update document metadata (e.g., description)."""
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if payload.description is not None:
        document.description = payload.description
    if getattr(payload, 'owner_id', None) is not None:
        document.owner_id = payload.owner_id
    if getattr(payload, 'review_date', None) is not None:
        document.review_date = payload.review_date
    if getattr(payload, 'category_id', None) is not None:
        document.category_id = payload.category_id
    document.updated_at = datetime.utcnow()
    session.add(document)
    session.commit()
    session.refresh(document)
    return _to_read_model(document)

@router.post("/documents/{document_id}/sign", response_model=DocumentRead)
async def sign_document(
    document_id: UUID,
    data: DocumentSign,
    session: Session = Depends(get_session)
):
    """Mark a document as signed with signer name and timestamp."""
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    document.is_signed = True
    document.signed_by = data.signed_by
    document.signed_at = datetime.utcnow()
    document.updated_at = datetime.utcnow()

    session.add(document)
    session.commit()
    session.refresh(document)
    return _to_read_model(document)
