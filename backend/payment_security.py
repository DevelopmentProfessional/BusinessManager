"""Encryption helpers for payment account details.

The encryption key must be supplied through PAYMENT_DATA_ENCRYPTION_KEY.
It is intentionally not generated at runtime: an ephemeral key would make
stored payment details unrecoverable after a restart.
"""

import base64
import hashlib
import json
import os

from cryptography.fernet import Fernet, InvalidToken


def _fernet() -> Fernet:
    key = os.getenv("PAYMENT_DATA_ENCRYPTION_KEY")
    if not key:
        raise RuntimeError("PAYMENT_DATA_ENCRYPTION_KEY is not configured.")
    try:
        return Fernet(key.encode("ascii"))
    except (ValueError, TypeError) as exc:
        raise RuntimeError("PAYMENT_DATA_ENCRYPTION_KEY must be a Fernet key.") from exc


def encrypt_details(details: dict) -> str:
    payload = json.dumps(details, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return _fernet().encrypt(payload).decode("ascii")


def masked_last4(details: dict) -> str | None:
    for key in ("account_number", "card_number", "account_id", "email"):
        value = str(details.get(key) or "").strip()
        if value:
            compact = "".join(value.split())
            return compact[-4:]
    return None


def reject_prohibited_card_data(method_type: str, details: dict) -> None:
    prohibited = {"cvv", "cvc", "security_code", "card_security_code"}
    if prohibited.intersection(details):
        raise ValueError("Security codes must never be submitted or stored.")
    if method_type in {"card", "card_provider"} and details.get("card_number"):
        raise ValueError("Use a payment-provider token instead of a raw card number.")


def details_fingerprint(details: dict) -> str:
    canonical = json.dumps(details, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return base64.urlsafe_b64encode(hashlib.sha256(canonical).digest()).decode("ascii").rstrip("=")


def decrypt_details(value: str) -> dict:
    try:
        return json.loads(_fernet().decrypt(value.encode("ascii")).decode("utf-8"))
    except (InvalidToken, ValueError, TypeError, json.JSONDecodeError) as exc:
        raise RuntimeError("Stored payment details could not be decrypted.") from exc
