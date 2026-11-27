import os
import smtplib
import ssl
from email.message import EmailMessage
from typing import Optional, Sequence

try:
    import boto3
    from botocore.exceptions import BotoCoreError, ClientError
except ModuleNotFoundError:
    boto3 = None

    class BotoCoreError(Exception):
        pass

    class ClientError(Exception):
        pass


class EmailDeliveryError(RuntimeError):
    pass


def send_email(
    *,
    recipient: str | Sequence[str],
    subject: str,
    text_body: str,
    html_body: Optional[str] = None,
    reply_to: Optional[str] = None,
    cc_recipients: Sequence[str] = (),
    attachments: Sequence[tuple[str, bytes, str]] = (),
) -> None:
    recipients = [recipient] if isinstance(recipient, str) else list(recipient)
    if not recipients:
        raise ValueError("At least one email recipient is required.")
    sender = (
        (os.getenv("AWS_SES_FROM_EMAIL") or "").strip()
        or (os.getenv("SMTP_FROM_EMAIL") or "").strip()
        or (os.getenv("SMTP_USERNAME") or "").strip()
    )
    if not sender:
        raise EmailDeliveryError(
            "Email sender is not configured. Set AWS_SES_FROM_EMAIL, SMTP_FROM_EMAIL, or SMTP_USERNAME to a provider-authorized address."
        )
    ses_region = (os.getenv("AWS_SES_REGION") or os.getenv("AWS_REGION") or "us-east-1").strip()
    smtp_host = (os.getenv("SMTP_HOST") or "").strip()

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = ", ".join(recipients)
    if cc_recipients:
        message["Cc"] = ", ".join(cc_recipients)
    if reply_to:
        message["Reply-To"] = reply_to
    message.set_content(text_body)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    for filename, content, content_type in attachments:
        maintype, subtype = content_type.split("/", 1)
        message.add_attachment(content, maintype=maintype, subtype=subtype, filename=filename)

    ses_error = None
    if boto3 is not None:
        try:
            ses_client = boto3.client("sesv2", region_name=ses_region)
            request = {
                "FromEmailAddress": sender,
                "Destination": {"ToAddresses": recipients},
                "Content": {"Raw": {"Data": message.as_bytes()}},
            }
            if cc_recipients:
                request["Destination"]["CcAddresses"] = list(cc_recipients)
            if reply_to:
                request["ReplyToAddresses"] = [reply_to]
            ses_client.send_email(**request)
            return
        except (BotoCoreError, ClientError) as exc:
            ses_error = exc

    if smtp_host:
        try:
            smtp_port = int((os.getenv("SMTP_PORT") or "587").strip())
            smtp_username = (os.getenv("SMTP_USERNAME") or "").strip()
            smtp_password = os.getenv("SMTP_PASSWORD") or ""
            use_ssl = (os.getenv("SMTP_USE_SSL") or "").strip().lower() in {"1", "true", "yes", "on"}
            use_tls = (os.getenv("SMTP_USE_TLS") or "true").strip().lower() in {"1", "true", "yes", "on"}
            if use_ssl:
                with smtplib.SMTP_SSL(smtp_host, smtp_port, context=ssl.create_default_context(), timeout=20) as server:
                    if smtp_username:
                        server.login(smtp_username, smtp_password)
                    server.send_message(message)
            else:
                with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                    if use_tls:
                        server.starttls(context=ssl.create_default_context())
                    if smtp_username:
                        server.login(smtp_username, smtp_password)
                    server.send_message(message)
            return
        except (OSError, smtplib.SMTPException, ValueError) as exc:
            raise EmailDeliveryError("Email delivery failed. Check the configured SES/SMTP sender and credentials.") from exc

    raise EmailDeliveryError("Email delivery is not configured or available. Configure a verified SES/SMTP sender.") from ses_error
