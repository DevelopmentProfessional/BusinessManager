"""Shim for backward compatibility — implementation moved to backend.services.email_delivery."""
try:
    from backend.services.email_delivery import *  # noqa: F401, F403
except ModuleNotFoundError:
    from services.email_delivery import *  # type: ignore  # noqa: F401, F403
