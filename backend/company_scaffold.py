"""Shim for backward compatibility — implementation moved to backend.services.company_scaffold."""
try:
    from backend.services.company_scaffold import *  # noqa: F401, F403
    from backend.services.company_scaffold import _load_template_seed_rows  # noqa: F401
except ModuleNotFoundError:
    from services.company_scaffold import *  # type: ignore  # noqa: F401, F403
    from services.company_scaffold import _load_template_seed_rows  # type: ignore  # noqa: F401
