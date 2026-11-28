import base64
import binascii
import hashlib
import logging
import re
import secrets
from datetime import datetime, timedelta
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlmodel import Session, select

try:
    from backend.database import get_session
    from backend.email_delivery import EmailDeliveryError, send_email
    from backend.models import AppSettings, Client, Supplier, User
    from backend.routers.auth import get_current_user, has_page_permission, require_page_permission
    from backend.routers.settings import get_or_create_settings, resolve_company_id
except ModuleNotFoundError:
    from database import get_session
    from email_delivery import EmailDeliveryError, send_email
    from models import AppSettings, Client, Supplier, User
    from routers.auth import get_current_user, has_page_permission, require_page_permission
    from routers.settings import get_or_create_settings, resolve_company_id

router = APIRouter()
logger = logging.getLogger(__name__)

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
CODE_TTL = timedelta(minutes=10)
CODE_RESEND_DELAY = timedelta(seconds=60)
MAX_CODE_ATTEMPTS = 5
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
SEND_PAGES = {"clients", "suppliers", "employees", "schedule", "sales", "services", "inventory"}


class SendingEmailVerificationRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class VerificationCodeRequest(BaseModel):
    code: str = Field(min_length=8, max_length=8)


class ContactVerificationRequest(BaseModel):
    entity_type: Literal["client", "supplier"]
    entity_id: UUID


class ContactVerificationConfirmRequest(ContactVerificationRequest):
    code: str = Field(min_length=8, max_length=8)


class EmailSendRecipient(BaseModel):
    recipient_type: Literal["client", "supplier", "employee", "external"]
    recipient_id: Optional[UUID] = None
    email: str = Field(min_length=3, max_length=254)


class EmailSendRequest(BaseModel):
    page: str
    recipients: list[EmailSendRecipient] = Field(default_factory=list, max_length=100)
    cc_recipients: list[EmailSendRecipient] = Field(default_factory=list, max_length=100)
    recipient_type: Optional[Literal["client", "supplier", "employee", "external"]] = None
    recipient_id: Optional[UUID] = None
    recipient_email: Optional[str] = Field(default=None, min_length=3, max_length=254)
    subject: str = Field(min_length=1, max_length=200)
    text_body: str = Field(min_length=1, max_length=100_000)
    attachment_name: Optional[str] = Field(default=None, max_length=150)
    attachment_base64: Optional[str] = Field(default=None, max_length=14_000_000)


def _normalize_email(value: str) -> str:
    email = value.strip().lower()
    if len(email) > 254 or not EMAIL_PATTERN.fullmatch(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    return email


def _new_code() -> str:
    return f"{secrets.randbelow(100_000_000):08d}"


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("ascii")).hexdigest()


def _clear_challenge(record, prefix: str = "email") -> None:
    setattr(record, f"{prefix}_verification_code_hash", None)
    setattr(record, f"{prefix}_verification_expires_at", None)
    setattr(record, f"{prefix}_verification_sent_at", None)
    setattr(record, f"{prefix}_verification_attempts", 0)


def _send_verification_code(recipient: str, code: str, subject: str, company_name: str, reply_to: Optional[str] = None) -> None:
    try:
        send_email(
            recipient=recipient,
            subject=subject,
            text_body=(
                f"Your {company_name} email verification code is {code}.\n\n"
                "Enter this code in BusinessManager within 10 minutes. "
                "If you did not request it, you can ignore this message."
            ),
            reply_to=reply_to,
        )
    except EmailDeliveryError as exc:
        logger.warning("Email verification delivery failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


def _get_contact(session: Session, current_user: User, entity_type: str, entity_id: UUID):
    model = Client if entity_type == "client" else Supplier
    record = session.exec(
        select(model).where(model.id == entity_id, model.company_id == resolve_company_id(session, current_user))
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"{entity_type.title()} not found.")
    return record


@router.get("/contacts")
def search_email_contacts(
    page: str,
    q: Optional[str] = Query(default=None, max_length=100),
    contact_type: Optional[Literal["client", "supplier", "employee"]] = Query(default=None, alias="type"),
    ids: Optional[str] = Query(default=None, max_length=4000),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if page not in SEND_PAGES:
        raise HTTPException(status_code=400, detail="Email contacts are not available from this page.")
    require_page_permission(current_user, session, page, "read")

    record_ids = None
    if ids:
        try:
            record_ids = [UUID(value.strip()) for value in ids.split(",") if value.strip()]
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="One or more contact IDs are invalid.") from exc
        if not record_ids or len(record_ids) > 100:
            raise HTTPException(status_code=400, detail="Provide between 1 and 100 contact IDs.")
        if not contact_type:
            raise HTTPException(status_code=400, detail="A contact type is required when looking up contact IDs.")
    elif not q or len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Enter at least two characters to search contacts.")

    contact_types = [contact_type] if contact_type else ["client", "supplier", "employee"]
    company_id = resolve_company_id(session, current_user)
    pattern = None
    if q:
        escaped_query = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped_query}%"

    contacts = []
    model_by_type = {"client": Client, "supplier": Supplier, "employee": User}
    for kind in contact_types:
        page_for_type = f"{kind}s"
        if not has_page_permission(current_user, session, page_for_type, "read"):
            if record_ids:
                raise HTTPException(status_code=403, detail=f"Missing permission: {page_for_type}:read")
            continue

        model = model_by_type[kind]
        statement = select(model).where(model.company_id == company_id)
        if record_ids:
            statement = statement.where(model.id.in_(record_ids))
        else:
            statement = statement.where(model.email.is_not(None), model.email != "")
            if kind == "client":
                statement = statement.where(
                    or_(
                        Client.name.ilike(pattern, escape="\\"),
                        Client.email.ilike(pattern, escape="\\"),
                    )
                )
            elif kind == "supplier":
                statement = statement.where(
                    or_(
                        Supplier.name.ilike(pattern, escape="\\"),
                        Supplier.contact_person.ilike(pattern, escape="\\"),
                        Supplier.email.ilike(pattern, escape="\\"),
                    )
                )
            else:
                statement = statement.where(
                    User.is_active.is_(True),
                    or_(
                        User.first_name.ilike(pattern, escape="\\"),
                        User.last_name.ilike(pattern, escape="\\"),
                        User.username.ilike(pattern, escape="\\"),
                        User.email.ilike(pattern, escape="\\"),
                    ),
                )
        statement = statement.order_by(model.name if kind != "employee" else User.first_name).limit(30)
        for record in session.exec(statement).all():
            name = record.name if kind != "employee" else f"{record.first_name} {record.last_name}".strip()
            contacts.append(
                {
                    "id": str(record.id),
                    "type": kind,
                    "name": name or record.username,
                    "email": record.email,
                    "email_verified": bool(getattr(record, "email_verified", False)),
                }
            )

    return {"contacts": contacts}


def _start_contact_verification(record, settings: AppSettings, session: Session) -> dict:
    if record.email_verified:
        return {"sent": False, "already_verified": True}

    recipient = _normalize_email(record.email or "")
    now = datetime.utcnow()
    if record.email_verification_sent_at and now - record.email_verification_sent_at < CODE_RESEND_DELAY:
        raise HTTPException(status_code=429, detail="Wait one minute before requesting another verification code.")

    code = _new_code()
    record.email_verification_code_hash = _hash_code(code)
    record.email_verification_expires_at = now + CODE_TTL
    record.email_verification_sent_at = now
    record.email_verification_attempts = 0
    company_name = (settings.company_name or "your company").strip()
    reply_to = settings.sending_email if settings.sending_email_verified else None
    _send_verification_code(recipient, code, "Verify your email address", company_name, reply_to)
    session.add(record)
    session.commit()
    return {"sent": True, "expires_in_minutes": 10}


def _confirm_challenge(
    record,
    code: str,
    session: Session,
    already_verified: bool = False,
    prefix: str = "email",
    verified_field: str = "email_verified",
) -> dict:
    if already_verified:
        return {"verified": True, "already_verified": True}

    stored_hash = getattr(record, f"{prefix}_verification_code_hash")
    expires_at = getattr(record, f"{prefix}_verification_expires_at")
    if not stored_hash or not expires_at or expires_at < datetime.utcnow():
        _clear_challenge(record, prefix)
        session.add(record)
        session.commit()
        raise HTTPException(status_code=400, detail="The verification code expired. Request a new code.")
    attempts_field = f"{prefix}_verification_attempts"
    if getattr(record, attempts_field) >= MAX_CODE_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many incorrect codes. Request a new verification code.")

    if not re.fullmatch(r"\d{8}", code) or not secrets.compare_digest(stored_hash, _hash_code(code)):
        setattr(record, attempts_field, getattr(record, attempts_field) + 1)
        session.add(record)
        session.commit()
        raise HTTPException(status_code=400, detail="That verification code is not correct.")

    setattr(record, verified_field, True)
    _clear_challenge(record, prefix)
    if hasattr(record, "updated_at"):
        record.updated_at = datetime.utcnow()
    session.add(record)
    session.commit()
    return {"verified": True}


@router.post("/sending-email/verification")
def request_sending_email_verification(
    payload: SendingEmailVerificationRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    require_page_permission(current_user, session, "settings", "write")
    email = _normalize_email(payload.email)
    settings = get_or_create_settings(session, resolve_company_id(session, current_user))
    if settings.sending_email == email and settings.sending_email_verified:
        return {"sent": False, "already_verified": True, "sending_email": email, "sending_email_verified": True}
    if settings.sending_email_verification_sent_at and datetime.utcnow() - settings.sending_email_verification_sent_at < CODE_RESEND_DELAY:
        raise HTTPException(status_code=429, detail="Wait one minute before requesting another verification code.")

    code = _new_code()
    settings.sending_email = email
    settings.sending_email_verified = False
    settings.sending_email_verification_code_hash = _hash_code(code)
    settings.sending_email_verification_expires_at = datetime.utcnow() + CODE_TTL
    settings.sending_email_verification_sent_at = datetime.utcnow()
    settings.sending_email_verification_attempts = 0
    _send_verification_code(email, code, "Verify your company sending email", settings.company_name or "your company")
    session.add(settings)
    session.commit()
    return {"sent": True, "sending_email": email, "sending_email_verified": False, "expires_in_minutes": 10}


@router.post("/sending-email/verification/confirm")
def confirm_sending_email_verification(
    payload: VerificationCodeRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    require_page_permission(current_user, session, "settings", "write")
    settings = get_or_create_settings(session, resolve_company_id(session, current_user))
    response = _confirm_challenge(
        settings,
        payload.code,
        session,
        settings.sending_email_verified,
        prefix="sending_email",
        verified_field="sending_email_verified",
    )
    settings.sending_email_verified = True
    return {**response, "sending_email": settings.sending_email, "sending_email_verified": True}


@router.post("/contact-email/verification")
def request_contact_email_verification(
    payload: ContactVerificationRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    require_page_permission(current_user, session, f"{payload.entity_type}s", "write")
    record = _get_contact(session, current_user, payload.entity_type, payload.entity_id)
    settings = get_or_create_settings(session, resolve_company_id(session, current_user))
    return _start_contact_verification(record, settings, session)


@router.post("/contact-email/verification/confirm")
def confirm_contact_email_verification(
    payload: ContactVerificationConfirmRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    require_page_permission(current_user, session, f"{payload.entity_type}s", "write")
    record = _get_contact(session, current_user, payload.entity_type, payload.entity_id)
    return _confirm_challenge(record, payload.code, session, record.email_verified)


def _resolve_email_recipient(recipient: EmailSendRecipient, current_user: User, session: Session, settings: AppSettings) -> str:
    email = _normalize_email(recipient.email)
    contact = None
    if recipient.recipient_type in {"client", "supplier"}:
        if not recipient.recipient_id:
            raise HTTPException(status_code=400, detail="The recipient record is missing.")
        require_page_permission(current_user, session, f"{recipient.recipient_type}s", "read")
        contact = _get_contact(session, current_user, recipient.recipient_type, recipient.recipient_id)
        if _normalize_email(contact.email or "") != email:
            raise HTTPException(status_code=400, detail="The recipient email changed. Refresh the record and try again.")
        required = (
            settings.require_client_email_verification_before_send
            if recipient.recipient_type == "client"
            else settings.require_supplier_email_verification_before_send
        )
        if required and not contact.email_verified:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "recipient_email_unverified",
                    "message": "This contact email must be verified before sending. Send a verification code and confirm it first.",
                    "recipient": {
                        "type": recipient.recipient_type,
                        "id": str(recipient.recipient_id),
                    },
                },
            )
    elif recipient.recipient_type == "employee":
        if not recipient.recipient_id:
            raise HTTPException(status_code=400, detail="The employee recipient record is missing.")
        require_page_permission(current_user, session, "employees", "read")
        employee = session.exec(
            select(User).where(
                User.id == recipient.recipient_id,
                User.company_id == resolve_company_id(session, current_user),
            )
        ).first()
        if not employee or _normalize_email(employee.email or "") != email:
            raise HTTPException(status_code=400, detail="The employee email changed. Refresh the record and try again.")
    return email


def _resolve_recipient(payload: EmailSendRequest, current_user: User, session: Session, settings: AppSettings) -> str:
    if payload.page not in SEND_PAGES:
        raise HTTPException(status_code=400, detail="Email sending is not available from this page.")
    require_page_permission(current_user, session, payload.page, "read")
    if not payload.recipient_email or not payload.recipient_type:
        raise HTTPException(status_code=400, detail="Choose at least one recipient before sending.")
    return _resolve_email_recipient(
        EmailSendRecipient(
            recipient_type=payload.recipient_type,
            recipient_id=payload.recipient_id,
            email=payload.recipient_email,
        ),
        current_user,
        session,
        settings,
    )


@router.post("/send")
def send_application_email(
    payload: EmailSendRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    settings = get_or_create_settings(session, current_user.company_id or "")
    if not settings.sending_email or not settings.sending_email_verified:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "sender_email_unverified",
                "message": "Add and verify the company's Sending Email in Profile > General Settings before sending.",
            },
        )
    if payload.page not in SEND_PAGES:
        raise HTTPException(status_code=400, detail="Email sending is not available from this page.")
    require_page_permission(current_user, session, payload.page, "read")
    recipient_entries = payload.recipients
    if not recipient_entries and payload.recipient_email and payload.recipient_type:
        recipient_entries = [
            EmailSendRecipient(
                recipient_type=payload.recipient_type,
                recipient_id=payload.recipient_id,
                email=payload.recipient_email,
            )
        ]
    if not recipient_entries:
        raise HTTPException(status_code=400, detail="Choose at least one recipient before sending.")

    recipient_emails = list(
        dict.fromkeys(
            _resolve_email_recipient(entry, current_user, session, settings)
            for entry in recipient_entries
        )
    )
    cc_emails = list(
        dict.fromkeys(
            _resolve_email_recipient(entry, current_user, session, settings)
            for entry in payload.cc_recipients
        )
    )
    cc_emails = [email for email in cc_emails if email not in recipient_emails]

    attachments = []
    if payload.attachment_base64:
        try:
            attachment = base64.b64decode(payload.attachment_base64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise HTTPException(status_code=400, detail="The email attachment is invalid.") from exc
        if len(attachment) > MAX_ATTACHMENT_BYTES:
            raise HTTPException(status_code=413, detail="Email attachments must be 10 MB or smaller.")
        if not attachment.startswith(b"%PDF-"):
            raise HTTPException(status_code=400, detail="Only generated PDF attachments can be emailed.")
        filename = re.sub(r"[^A-Za-z0-9._ -]", "", payload.attachment_name or "document.pdf").strip() or "document.pdf"
        attachments.append((filename, attachment, "application/pdf"))

    try:
        send_email(
            recipient=recipient_emails,
            cc_recipients=cc_emails,
            subject=payload.subject.strip(),
            text_body=payload.text_body,
            reply_to=settings.sending_email,
            attachments=attachments,
        )
    except EmailDeliveryError as exc:
        logger.exception("Application email delivery failed")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"sent": True}
