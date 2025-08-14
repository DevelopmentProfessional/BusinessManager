from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlmodel import Session, select
from typing import List
from uuid import UUID
from database import get_session
from models import Document, EntityType
import os
import shutil

router = APIRouter()

@router.get("/documents", response_model=List[Document])
async def get_documents(session: Session = Depends(get_session)):
    """Get all documents"""
    documents = session.exec(select(Document)).all()
    return documents

@router.get("/documents/{entity_type}/{entity_id}", response_model=List[Document])
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
    return documents

@router.post("/documents", response_model=Document)
async def upload_document(
    entity_type: EntityType,
    entity_id: UUID,
    description: str = None,
    file: UploadFile = File(...),
    session: Session = Depends(get_session)
):
    """Upload a document for an entity"""
    # Create uploads directory if it doesn't exist
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Generate unique filename
    file_path = os.path.join(upload_dir, f"{entity_id}_{file.filename}")
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Create document record
    document = Document(
        filename=f"{entity_id}_{file.filename}",
        original_filename=file.filename,
        file_path=file_path,
        file_size=os.path.getsize(file_path),
        content_type=file.content_type,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description
    )
    
    session.add(document)
    session.commit()
    session.refresh(document)
    return document

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
async def download_document(document_id: UUID, session: Session = Depends(get_session)):
    """Serve the raw document file for preview/download."""
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if not os.path.exists(document.file_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    return FileResponse(
        path=document.file_path,
        media_type=document.content_type or 'application/octet-stream',
        filename=document.original_filename or os.path.basename(document.file_path),
    )
