"""Shim for backward compatibility — implementation moved to backend.services.inventory_replenishment."""
try:
    from backend.services.inventory_replenishment import *  # noqa: F401, F403
except ModuleNotFoundError:
    from services.inventory_replenishment import *  # type: ignore  # noqa: F401, F403
