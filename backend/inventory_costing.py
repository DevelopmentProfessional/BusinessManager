"""Shim for backward compatibility — implementation moved to backend.services.inventory_costing."""
try:
    from backend.services.inventory_costing import *  # noqa: F401, F403
except ModuleNotFoundError:
    from services.inventory_costing import *  # type: ignore  # noqa: F401, F403
