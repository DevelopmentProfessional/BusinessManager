"""Shim for backward compatibility — implementation moved to backend.services.payment_security."""
try:
    from backend.services.payment_security import *  # noqa: F401, F403
except ModuleNotFoundError:
    from services.payment_security import *  # type: ignore  # noqa: F401, F403
