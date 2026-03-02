"""
cleanup.py — CleanupRegistry: tracks created resources and deletes them in
reverse-creation order after the test session completes.

Zero residual data guarantee: every record created during a test run is
registered here and deleted in teardown, even if tests fail mid-run.
"""
import logging
import threading
from dataclasses import dataclass, field
from typing import List, Optional
from pathlib import Path
import httpx
from config import BASE_URL, REQUEST_TIMEOUT

log = logging.getLogger(__name__)
_LOG_FILE = Path(__file__).parent.parent / "cleanup.log"


@dataclass
class _Entry:
    method: str       # "DELETE", "PUT", etc.
    url: str          # full path, e.g. /api/v1/isud/clients/{id}
    token: str        # bearer token for the delete request
    label: str = ""   # human-readable description for the log


class CleanupRegistry:
    """
    Thread-safe registry of resources to delete after a test run.

    Usage:
        registry.register("/api/v1/isud/clients/{id}", token=admin_token, label="client XYZ")
        # ... later, in session finalizer:
        registry.teardown()
    """

    def __init__(self):
        self._entries: List[_Entry] = []
        self._lock = threading.Lock()

    def register(
        self,
        url: str,
        token: str,
        label: str = "",
        method: str = "DELETE",
    ) -> None:
        """Register a resource URL to be cleaned up."""
        entry = _Entry(method=method, url=url, token=token, label=label)
        with self._lock:
            self._entries.append(entry)

    def teardown(self) -> None:
        """Delete all registered resources in reverse creation order."""
        with self._lock:
            entries = list(reversed(self._entries))
            self._entries.clear()

        if not entries:
            log.info("CleanupRegistry: nothing to clean up.")
            return

        log.info(f"CleanupRegistry: tearing down {len(entries)} resource(s)...")
        errors: List[str] = []

        with httpx.Client(base_url=BASE_URL, timeout=REQUEST_TIMEOUT) as client:
            for entry in entries:
                try:
                    headers = {"Authorization": f"Bearer {entry.token}"}
                    resp = getattr(client, entry.method.lower())(
                        entry.url, headers=headers
                    )
                    status = resp.status_code
                    if status in (200, 204, 404):
                        log.info(f"  [OK {status}] {entry.method} {entry.url}  {entry.label}")
                    else:
                        msg = f"  [WARN {status}] {entry.method} {entry.url}  {entry.label}"
                        log.warning(msg)
                        errors.append(msg)
                except Exception as exc:
                    msg = f"  [ERR] {entry.method} {entry.url}  {entry.label}: {exc}"
                    log.error(msg)
                    errors.append(msg)

        # Write cleanup log
        try:
            with open(_LOG_FILE, "w") as f:
                f.write(f"CleanupRegistry teardown — {len(entries)} entries\n")
                if errors:
                    f.write("ERRORS:\n")
                    for e in errors:
                        f.write(f"  {e}\n")
                else:
                    f.write("All entries cleaned up successfully.\n")
        except OSError:
            pass

        if errors:
            log.warning(f"CleanupRegistry: {len(errors)} error(s) during teardown. See cleanup.log.")
        else:
            log.info("CleanupRegistry: teardown complete.")


# Module-level singleton — shared via conftest fixture
_global_registry: Optional[CleanupRegistry] = None


def get_registry() -> CleanupRegistry:
    """Return the module-level CleanupRegistry, creating it if needed."""
    global _global_registry
    if _global_registry is None:
        _global_registry = CleanupRegistry()
    return _global_registry
