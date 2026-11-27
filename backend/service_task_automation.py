"""Shim for backward compatibility — implementation moved to backend.services.service_task_automation."""
try:
    from backend.services.service_task_automation import *  # noqa: F401, F403
except ModuleNotFoundError:
    from services.service_task_automation import *  # type: ignore  # noqa: F401, F403
