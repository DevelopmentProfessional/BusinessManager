from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, or_, and_
from uuid import UUID

try:
    from backend.database import get_session
    from backend.models import ChatMessage, ChatMessageCreate, ChatMessageRead, User
    from backend.routers.auth import get_current_user
except ModuleNotFoundError:
    from database import get_session
    from models import ChatMessage, ChatMessageCreate, ChatMessageRead, User
    from routers.auth import get_current_user

router = APIRouter()


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
    except Exception:
        session.rollback()
        raise HTTPException(status_code=500, detail="Failed to send message")
    return msg


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
    except Exception:
        session.rollback()
        raise HTTPException(status_code=500, detail="Failed to mark messages as read")
    return {"marked_read": len(messages)}


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
