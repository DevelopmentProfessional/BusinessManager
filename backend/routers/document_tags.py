"""
Router: /api/v1/document-tags  and  /api/v1/documents/{id}/tags
CRUD for company-scoped document tags and per-document tag assignment.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from sqlalchemy import text
from typing import List, Optional
from uuid import UUID

try:
    from backend.database import get_session
    from backend.models import DocumentTag, DocumentTagLink, DocumentTagRead
    from backend.routers.auth import get_current_user
    from backend.utils.db_helpers import safe_commit, safe_commit_refresh
except ImportError:
    from database import get_session
    from models import DocumentTag, DocumentTagLink, DocumentTagRead
    from routers.auth import get_current_user
    from utils.db_helpers import safe_commit, safe_commit_refresh

router = APIRouter()


# ─── Company tag library ────────────────────────────────────────────────────────

@router.get("/document-tags", response_model=List[DocumentTagRead])
def list_document_tags(
    q: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """List all tags for the company, optionally filtered by name search."""
    company_id = getattr(current_user, "company_id", None)
    stmt = select(DocumentTag).where(DocumentTag.company_id == company_id)
    if q:
        stmt = stmt.where(DocumentTag.name.ilike(f"%{q}%"))
    stmt = stmt.order_by(DocumentTag.name)
    return session.exec(stmt).all()


@router.post("/document-tags", response_model=DocumentTagRead, status_code=201)
def create_document_tag(
    payload: dict,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """Create a new tag (deduplicates by name within company)."""
    company_id = getattr(current_user, "company_id", None)
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="name is required")

    existing = session.exec(
        select(DocumentTag).where(
            DocumentTag.company_id == company_id,
            DocumentTag.name == name,
        )
    ).first()
    if existing:
        return existing

    tag = DocumentTag(name=name, company_id=company_id)
    session.add(tag)
    return safe_commit_refresh(session, tag, "create tag")


@router.delete("/document-tags/{tag_id}", status_code=204)
def delete_document_tag(
    tag_id: UUID,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    company_id = getattr(current_user, "company_id", None)
    tag = session.get(DocumentTag, tag_id)
    if not tag or tag.company_id != company_id:
        raise HTTPException(status_code=404, detail="Tag not found")
    session.delete(tag)
    safe_commit(session, "delete tag")


# ─── Per-document tag endpoints ─────────────────────────────────────────────────

@router.get("/documents/{document_id}/tags", response_model=List[DocumentTagRead])
def get_document_tags(
    document_id: UUID,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """Get all tags attached to a specific document."""
    company_id = getattr(current_user, "company_id", None)
    links = session.exec(
        select(DocumentTagLink).where(
            DocumentTagLink.document_id == document_id,
            DocumentTagLink.company_id == company_id,
        )
    ).all()
    tag_ids = [lnk.tag_id for lnk in links]
    if not tag_ids:
        return []
    tags = session.exec(
        select(DocumentTag).where(DocumentTag.id.in_(tag_ids))
    ).all()
    return tags


@router.put("/documents/{document_id}/tags", response_model=List[DocumentTagRead])
def set_document_tags(
    document_id: UUID,
    payload: dict,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """Replace all tags on a document with the supplied list of tag_ids."""
    company_id = getattr(current_user, "company_id", None)
    tag_ids = payload.get("tag_ids") or []

    # Remove existing links
    existing_links = session.exec(
        select(DocumentTagLink).where(
            DocumentTagLink.document_id == document_id,
            DocumentTagLink.company_id == company_id,
        )
    ).all()
    for lnk in existing_links:
        session.delete(lnk)

    # Add new links
    result_tags = []
    for tid in tag_ids:
        try:
            tid_uuid = UUID(str(tid))
        except ValueError:
            continue
        tag = session.get(DocumentTag, tid_uuid)
        if not tag or tag.company_id != company_id:
            continue
        lnk = DocumentTagLink(document_id=document_id, tag_id=tid_uuid, company_id=company_id)
        session.add(lnk)
        result_tags.append(tag)

    safe_commit(session, "update tags")
    return result_tags


# ─── All tag-links for the company (used by frontend for tag-aware search) ──────

@router.get("/document-tag-links")
def list_document_tag_links(
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """Return {document_id: [tag_names]} map for the company (used for search)."""
    company_id = getattr(current_user, "company_id", None)
    rows = session.execute(
        text("""
            SELECT dtl.document_id, dt.name
            FROM document_tag_link dtl
            JOIN document_tag dt ON dt.id = dtl.tag_id
            WHERE dtl.company_id = :cid
            ORDER BY dt.name
        """),
        {"cid": company_id},
    ).fetchall()
    result: dict = {}
    for row in rows:
        doc_id = str(row[0])
        tag_name = row[1]
        result.setdefault(doc_id, []).append(tag_name)
    return result
