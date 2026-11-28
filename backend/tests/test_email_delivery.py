from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend import email_delivery
from backend.routers import email as email_router


def test_send_email_requires_configured_sender(monkeypatch):
    for key in (
        "AWS_SES_FROM_EMAIL",
        "AWS_SES_REGION",
        "AWS_REGION",
        "SMTP_FROM_EMAIL",
        "SMTP_USERNAME",
        "SMTP_HOST",
    ):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setattr(email_delivery, "boto3", None)

    with pytest.raises(email_delivery.EmailDeliveryError, match="sender is not configured"):
        email_delivery.send_email(
            recipient="recipient@example.com",
            subject="Test",
            text_body="Test message",
        )


def test_send_email_uses_configured_smtp_sender_and_reply_to(monkeypatch):
    sent_messages = []

    class FakeSMTP:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def starttls(self, context):
            assert context is not None

        def send_message(self, message):
            sent_messages.append(message)

    for key in ("AWS_SES_FROM_EMAIL", "AWS_SES_REGION", "AWS_REGION"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_FROM_EMAIL", "provider@example.com")
    monkeypatch.setattr(email_delivery, "boto3", None)
    monkeypatch.setattr(email_delivery.smtplib, "SMTP", lambda *_args, **_kwargs: FakeSMTP())

    email_delivery.send_email(
        recipient="recipient@example.com",
        subject="Test",
        text_body="Test message",
        reply_to="company@example.com",
    )

    assert len(sent_messages) == 1
    assert sent_messages[0]["From"] == "provider@example.com"
    assert sent_messages[0]["Reply-To"] == "company@example.com"


def test_send_email_supports_multiple_to_and_cc_recipients(monkeypatch):
    sent_messages = []

    class FakeSMTP:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def starttls(self, context):
            assert context is not None

        def send_message(self, message):
            sent_messages.append(message)

    for key in ("AWS_SES_FROM_EMAIL", "AWS_SES_REGION", "AWS_REGION"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_FROM_EMAIL", "provider@example.com")
    monkeypatch.setattr(email_delivery, "boto3", None)
    monkeypatch.setattr(email_delivery.smtplib, "SMTP", lambda *_args, **_kwargs: FakeSMTP())

    email_delivery.send_email(
        recipient=["first@example.com", "second@example.com"],
        cc_recipients=["manager@example.com"],
        subject="Test",
        text_body="Test message",
    )

    assert len(sent_messages) == 1
    assert sent_messages[0]["To"] == "first@example.com, second@example.com"
    assert sent_messages[0]["Cc"] == "manager@example.com"


@pytest.mark.parametrize(
    ("page", "recipient_type", "policy_field"),
    [
        ("clients", "client", "require_client_email_verification_before_send"),
        ("suppliers", "supplier", "require_supplier_email_verification_before_send"),
    ],
)
def test_recipient_verification_policy_blocks_unverified_contacts(
    monkeypatch, page, recipient_type, policy_field
):
    contact = SimpleNamespace(
        id=uuid4(),
        company_id="company-1",
        email="contact@example.com",
        email_verified=False,
    )
    session = SimpleNamespace(exec=lambda _query: SimpleNamespace(first=lambda: contact))
    current_user = SimpleNamespace(company_id="company-1")
    settings = SimpleNamespace(**{policy_field: True})
    payload = email_router.EmailSendRequest(
        page=page,
        recipient_type=recipient_type,
        recipient_id=contact.id,
        recipient_email=contact.email,
        subject="Test",
        text_body="Test message",
    )
    monkeypatch.setattr(email_router, "require_page_permission", lambda *_args: None)

    with pytest.raises(HTTPException) as error:
        email_router._resolve_recipient(payload, current_user, session, settings)

    assert error.value.status_code == 409
    assert error.value.detail["code"] == "recipient_email_unverified"


@pytest.mark.parametrize(
    ("page", "recipient_type", "policy_field"),
    [
        ("clients", "client", "require_client_email_verification_before_send"),
        ("suppliers", "supplier", "require_supplier_email_verification_before_send"),
    ],
)
def test_recipient_verification_policy_defaults_to_allowing_unverified_contacts(
    monkeypatch, page, recipient_type, policy_field
):
    contact = SimpleNamespace(
        id=uuid4(),
        company_id="company-1",
        email="contact@example.com",
        email_verified=False,
    )
    session = SimpleNamespace(exec=lambda _query: SimpleNamespace(first=lambda: contact))
    current_user = SimpleNamespace(company_id="company-1")
    settings = SimpleNamespace(**{policy_field: False})
    payload = email_router.EmailSendRequest(
        page=page,
        recipient_type=recipient_type,
        recipient_id=contact.id,
        recipient_email=contact.email,
        subject="Test",
        text_body="Test message",
    )
    monkeypatch.setattr(email_router, "require_page_permission", lambda *_args: None)

    assert email_router._resolve_recipient(payload, current_user, session, settings) == contact.email
