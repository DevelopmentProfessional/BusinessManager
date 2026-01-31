"""
Documents router - handles document upload, download, and management
"""
import os
import uuid
import shutil
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from fastapi.responses import FileResponse
from sqlmodel import Session, select
from pydantic import BaseModel

try:
    from backend.database import get_session
    from backend.models import Document, DocumentCategory, User
    from backend.routers.auth import get_current_user
except ModuleNotFoundError:
    from database import get_session
    from models import Document, DocumentCategory, User
    from routers.auth import get_current_user

router = APIRouter()

# Configure upload directory
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ============================================================================
# Pydantic schemas for request/response
# ============================================================================

class DocumentRead(BaseModel):
    id: UUID
    filename: str
    original_filename: str
    file_path: str
    file_size: int
    content_type: str
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    description: Optional[str] = None
    is_signed: bool = False
    signed_by: Optional[str] = None
    signed_at: Optional[datetime] = None
    owner_id: Optional[UUID] = None
    review_date: Optional[datetime] = None
    category_id: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DocumentUpdate(BaseModel):
    description: Optional[str] = None
    owner_id: Optional[str] = None  # Accept string to handle 'null' from frontend
    category_id: Optional[str] = None  # Accept string to handle 'null' from frontend
    review_date: Optional[str] = None  # Accept string to handle date parsing


class DocumentCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None


class DocumentCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class DocumentCategoryRead(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SignRequest(BaseModel):
    signed_by: str


# ============================================================================
# Document Category Endpoints
# ============================================================================

@router.get("/document-categories", response_model=List[DocumentCategoryRead])
async def list_document_categories(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List all document categories"""
    statement = select(DocumentCategory).order_by(DocumentCategory.name)
    categories = session.exec(statement).all()
    return categories


@router.post("/document-categories", response_model=DocumentCategoryRead, status_code=status.HTTP_201_CREATED)
async def create_document_category(
    category_data: DocumentCategoryCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new document category"""
    category = DocumentCategory(
        name=category_data.name,
        description=category_data.description
    )
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


@router.put("/document-categories/{category_id}", response_model=DocumentCategoryRead)
async def update_document_category(
    category_id: UUID,
    category_data: DocumentCategoryUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a document category"""
    category = session.get(DocumentCategory, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    if category_data.name is not None:
        category.name = category_data.name
    if category_data.description is not None:
        category.description = category_data.description

    category.updated_at = datetime.utcnow()
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


@router.delete("/document-categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document_category(
    category_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a document category"""
    category = session.get(DocumentCategory, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    session.delete(category)
    session.commit()
    return None


# ============================================================================
# Document Endpoints
# ============================================================================

@router.get("/documents", response_model=List[DocumentRead])
async def list_documents(
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[UUID] = Query(None),
    category_id: Optional[UUID] = Query(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List all documents with optional filtering"""
    statement = select(Document)

    if entity_type:
        statement = statement.where(Document.entity_type == entity_type)
    if entity_id:
        statement = statement.where(Document.entity_id == entity_id)
    if category_id:
        statement = statement.where(Document.category_id == category_id)

    statement = statement.order_by(Document.created_at.desc())
    documents = session.exec(statement).all()
    return documents


@router.get("/documents/{document_id}", response_model=DocumentRead)
async def get_document(
    document_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific document by ID"""
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.post("/documents", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    entity_type: Optional[str] = Form(None),
    entity_id: Optional[str] = Form(None),
    category_id: Optional[str] = Form(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Upload a new document"""
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1] if file.filename else ""
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    # Save file to disk
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Get file size
        file_size = os.path.getsize(file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Parse optional UUIDs
    parsed_entity_id = UUID(entity_id) if entity_id else None
    parsed_category_id = UUID(category_id) if category_id else None

    # Create document record
    document = Document(
        filename=unique_filename,
        original_filename=file.filename or "unknown",
        file_path=file_path,
        file_size=file_size,
        content_type=file.content_type or "application/octet-stream",
        description=description,
        entity_type=entity_type,
        entity_id=parsed_entity_id,
        category_id=parsed_category_id,
        owner_id=current_user.id
    )

    session.add(document)
    session.commit()
    session.refresh(document)
    return document


@router.post("/documents/bulk", response_model=List[DocumentRead], status_code=status.HTTP_201_CREATED)
async def upload_documents_bulk(
    files: List[UploadFile] = File(...),
    description: Optional[str] = Form(None),
    entity_type: Optional[str] = Form(None),
    entity_id: Optional[str] = Form(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Upload multiple documents at once"""
    documents = []
    parsed_entity_id = UUID(entity_id) if entity_id else None

    for file in files:
        file_ext = os.path.splitext(file.filename)[1] if file.filename else ""
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)

        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            file_size = os.path.getsize(file_path)
        except Exception as e:
            continue  # Skip failed files

        document = Document(
            filename=unique_filename,
            original_filename=file.filename or "unknown",
            file_path=file_path,
            file_size=file_size,
            content_type=file.content_type or "application/octet-stream",
            description=description,
            entity_type=entity_type,
            entity_id=parsed_entity_id,
            owner_id=current_user.id
        )
        session.add(document)
        documents.append(document)

    session.commit()
    for doc in documents:
        session.refresh(doc)

    return documents


@router.put("/documents/{document_id}", response_model=DocumentRead)
async def update_document(
    document_id: UUID,
    document_data: DocumentUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update document metadata"""
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Handle description
    if document_data.description is not None:
        document.description = document_data.description if document_data.description else None

    # Handle owner_id - convert string to UUID or None
    if document_data.owner_id is not None:
        if document_data.owner_id and document_data.owner_id.lower() not in ('null', 'none', ''):
            try:
                document.owner_id = UUID(document_data.owner_id)
            except (ValueError, TypeError):
                document.owner_id = None
        else:
            document.owner_id = None

    # Handle category_id - convert string to UUID or None
    if document_data.category_id is not None:
        if document_data.category_id and document_data.category_id.lower() not in ('null', 'none', ''):
            try:
                document.category_id = UUID(document_data.category_id)
            except (ValueError, TypeError):
                document.category_id = None
        else:
            document.category_id = None

    # Handle review_date - parse string to datetime or None
    if document_data.review_date is not None:
        if document_data.review_date and document_data.review_date.lower() not in ('null', 'none', ''):
            try:
                document.review_date = datetime.fromisoformat(document_data.review_date.replace('Z', '+00:00'))
            except (ValueError, TypeError):
                document.review_date = None
        else:
            document.review_date = None

    document.updated_at = datetime.utcnow()
    session.add(document)
    session.commit()
    session.refresh(document)
    return document


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a document and its file"""
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file from disk
    if os.path.exists(document.file_path):
        try:
            os.remove(document.file_path)
        except Exception:
            pass  # Continue even if file deletion fails

    session.delete(document)
    session.commit()
    return None


@router.get("/documents/{document_id}/download")
async def download_document(
    document_id: UUID,
    download: bool = Query(False, description="Force download instead of inline display"),
    session: Session = Depends(get_session)
):
    """Download a document file (no auth required for direct browser access)"""
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if not os.path.exists(document.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    # Set content disposition based on download parameter
    headers = {}
    if download:
        headers["Content-Disposition"] = f'attachment; filename="{document.original_filename}"'
    else:
        headers["Content-Disposition"] = f'inline; filename="{document.original_filename}"'

    return FileResponse(
        path=document.file_path,
        filename=document.original_filename,
        media_type=document.content_type,
        headers=headers
    )


@router.get("/documents/by-entity/{entity_type}/{entity_id}", response_model=List[DocumentRead])
async def get_documents_by_entity(
    entity_type: str,
    entity_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all documents for a specific entity"""
    statement = select(Document).where(
        Document.entity_type == entity_type,
        Document.entity_id == entity_id
    ).order_by(Document.created_at.desc())

    documents = session.exec(statement).all()
    return documents


@router.post("/documents/{document_id}/sign", response_model=DocumentRead)
async def sign_document(
    document_id: UUID,
    sign_data: SignRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Sign a document"""
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    document.is_signed = True
    document.signed_by = sign_data.signed_by
    document.signed_at = datetime.utcnow()
    document.updated_at = datetime.utcnow()

    session.add(document)
    session.commit()
    session.refresh(document)
    return document


# ============================================================================
# Document History (simplified - stores metadata about version changes)
# ============================================================================

@router.get("/documents/{document_id}/history")
async def get_document_history(
    document_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get document version history (placeholder - returns empty for now)"""
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # For now, return empty history - can be expanded with a DocumentHistory model
    return []


@router.put("/documents/{document_id}/content", response_model=DocumentRead)
async def replace_document_content(
    document_id: UUID,
    file: UploadFile = File(...),
    note: Optional[str] = Form(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Replace document content with a new file"""
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete old file
    if os.path.exists(document.file_path):
        try:
            os.remove(document.file_path)
        except Exception:
            pass

    # Save new file
    file_ext = os.path.splitext(file.filename)[1] if file.filename else ""
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file_size = os.path.getsize(file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Update document record
    document.filename = unique_filename
    document.original_filename = file.filename or document.original_filename
    document.file_path = file_path
    document.file_size = file_size
    document.content_type = file.content_type or document.content_type
    document.updated_at = datetime.utcnow()

    session.add(document)
    session.commit()
    session.refresh(document)
    return document


# ============================================================================
# Document Assignments (simplified)
# ============================================================================

@router.get("/documents/{document_id}/assignments")
async def list_document_assignments(
    document_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List document assignments (placeholder - returns empty for now)"""
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # For now, return empty assignments - can be expanded with a DocumentAssignment model
    return []


@router.post("/documents/{document_id}/assignments")
async def add_document_assignment(
    document_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add a document assignment (placeholder)"""
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return {"message": "Assignment feature not yet implemented"}


@router.delete("/documents/{document_id}/assignments/{user_id}")
async def remove_document_assignment(
    document_id: UUID,
    user_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Remove a document assignment (placeholder)"""
    return {"message": "Assignment feature not yet implemented"}
