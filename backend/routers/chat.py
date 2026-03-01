# ============================================================
# FILE: chat.py
#
# PURPOSE:
#   Provides direct one-to-one messaging between authenticated users. Supports
#   text messages and document-sharing messages, read-status tracking, and
#   per-sender unread counts to power a chat notification badge in the UI.
#
# FUNCTIONAL PARTS:
#   [1] Message History — retrieve the last 100 messages between two users
#   [2] Send Message — post a new text or document message to another user
#   [3] Mark as Read — bulk-mark all unread messages from a sender as read
#   [4] Unread Counts — return per-sender unread message counts for the current user
#
# CHANGE LOG — all modifications to this file must be recorded here:
#   Format : YYYY-MM-DD | Author | Description
#   ─────────────────────────────────────────────────────────────
#   2026-03-01 | Claude  | Added section comments and top-level documentation
# ============================================================

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, or_, and_
from uuid import UUID

log = logging.getLogger(__name__)

try:
    from backend.database import get_session
    from backend.models import ChatMessage, ChatMessageCreate, ChatMessageRead, User
    from backend.routers.auth import get_current_user
except ModuleNotFoundError:
    from database import get_session
    from models import ChatMessage, ChatMessageCreate, ChatMessageRead, User
    from routers.auth import get_current_user

router = APIRouter()


# ─── 1 MESSAGE HISTORY ─────────────────────────────────────────────────────────

@router.get("/chat/messages/{other_user_id}", response_model=list[ChatMessageRead], tags=["chat"])
def get_chat_history(
    other_user_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get chat history between the current user and another user (newest 100 messages)."""
    messages = session.exec(
        select(ChatMessage)
        .where(
            or_(
                and_(
                    ChatMessage.sender_id == current_user.id,
                    ChatMessage.receiver_id == other_user_id,
                ),
                and_(
                    ChatMessage.sender_id == other_user_id,
                    ChatMessage.receiver_id == current_user.id,
                ),
            )
        )
        .order_by(ChatMessage.created_at.asc())
        .limit(100)
    ).all()
    return messages


# ─── 2 SEND MESSAGE ────────────────────────────────────────────────────────────

@router.post("/chat/messages/{receiver_id}", response_model=ChatMessageRead, tags=["chat"])
def send_message(
    receiver_id: UUID,
    data: ChatMessageCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Send a text or document message to another user."""
    receiver = session.get(User, receiver_id)
    if not receiver:
        raise HTTPException(status_code=404, detail="Recipient not found")
    if not data.content and not data.document_id:
        raise HTTPException(status_code=400, detail="Message must have content or a document")

    msg = ChatMessage(
        sender_id=current_user.id,
        receiver_id=receiver_id,
        content=data.content,
        message_type=data.message_type,
        document_id=data.document_id,
    )
    session.add(msg)
    try:
        session.commit()
        session.refresh(msg)
    except Exception as exc:
        session.rollback()
        log.exception("Failed to save chat message: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to send message: {exc}")
    return msg


# ─── 3 MARK AS READ ────────────────────────────────────────────────────────────

@router.put("/chat/messages/{other_user_id}/read", tags=["chat"])
def mark_as_read(
    other_user_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Mark all messages from another user as read."""
    messages = session.exec(
        select(ChatMessage).where(
            ChatMessage.sender_id == other_user_id,
            ChatMessage.receiver_id == current_user.id,
            ChatMessage.is_read == False,
        )
    ).all()
    for msg in messages:
        msg.is_read = True
    try:
        session.commit()
    except Exception as exc:
        session.rollback()
        log.exception("Failed to mark messages as read: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to mark messages as read: {exc}")
    return {"marked_read": len(messages)}


# ─── 4 UNREAD COUNTS ───────────────────────────────────────────────────────────

@router.get("/chat/unread-counts", tags=["chat"])
def get_unread_counts(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Return a dict of {sender_id: unread_count} for the current user."""
    messages = session.exec(
        select(ChatMessage).where(
            ChatMessage.receiver_id == current_user.id,
            ChatMessage.is_read == False,
        )
    ).all()
    counts: dict[str, int] = {}
    for msg in messages:
        key = str(msg.sender_id)
        counts[key] = counts.get(key, 0) + 1
    return counts
