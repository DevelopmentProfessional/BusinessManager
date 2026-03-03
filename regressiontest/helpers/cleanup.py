"""
cleanup.py — CleanupRegistry: tracks created resources and deletes them.

Two modes of operation:

  1. IMMEDIATE  — call cleanup.delete_now(url, token, label) to delete a
                  resource right after the test that created it.  This is the
                  preferred "rolling insert-delete" pattern.

  2. DEFERRED   — call cleanup.register(url, token, label) to queue a resource
                  for deletion at teardown() time.  Used for session-scoped
                  resources (e.g. test users) that must persist across tests.

Pre-run sweep:
  Call sweep_regtest_data(admin_token) once at the very start of a test
  session.  It calls DELETE /api/v1/regtest/sweep which dynamically scans
  every database table for [REGTEST]-tagged records and removes them.  This
  cleans up any orphans left by a previously interrupted run.
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
    Thread-safe registry of resources to delete.

    Usage — immediate (preferred, rolling pattern):
        cleanup.delete_now("/api/v1/isud/clients/{id}", token=tok, label="client X")

    Usage — deferred (for session-scoped resources):
        cleanup.register("/api/v1/isud/clients/{id}", token=tok, label="client X")
        # ... later, in session finalizer:
        cleanup.teardown()
    """

    def __init__(self):
        self._entries: List[_Entry] = []
        self._lock = threading.Lock()

    # ── Deferred registration ──────────────────────────────────────────────────

    def register(
        self,
        url: str,
        token: str,
        label: str = "",
        method: str = "DELETE",
    ) -> None:
        """Queue a resource URL to be cleaned up at teardown()."""
        entry = _Entry(method=method, url=url, token=token, label=label)
        with self._lock:
            self._entries.append(entry)

    # ── Immediate deletion ─────────────────────────────────────────────────────

    def delete_now(
        self,
        url: str,
        token: str,
        label: str = "",
        method: str = "DELETE",
    ) -> bool:
        """
        Delete a resource immediately (rolling insert-delete pattern).

        Executes the HTTP request right now rather than queuing it.
        Returns True if the delete succeeded (200/204/404), False otherwise.
        404 is treated as success — the resource is already gone.
        """
        with httpx.Client(base_url=BASE_URL, timeout=REQUEST_TIMEOUT) as client:
            try:
                headers = {"Authorization": f"Bearer {token}"}
                resp = getattr(client, method.lower())(url, headers=headers)
                status = resp.status_code
                if status in (200, 204, 404):
                    log.info(f"  [IMMEDIATE OK {status}] {method} {url}  {label}")
                    return True
                else:
                    log.warning(f"  [IMMEDIATE WARN {status}] {method} {url}  {label}")
                    return False
            except Exception as exc:
                log.error(f"  [IMMEDIATE ERR] {method} {url}  {label}: {exc}")
                return False

    # ── Deferred teardown ──────────────────────────────────────────────────────

    def teardown(self) -> None:
        """Delete all queued (registered) resources in reverse creation order."""
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


# ── Pre-run sweep ──────────────────────────────────────────────────────────────

def sweep_regtest_data(admin_token: str) -> dict:
    """
    Call DELETE /api/v1/regtest/sweep to remove every [REGTEST]-tagged record
    from every database table.

    Dynamically covers all tables — no hardcoded list.  Safe to call at the
    start of every test session; if no orphaned data exists the endpoint
    returns quickly with total=0.

    Returns the response JSON: {"deleted": {...}, "total": N, "errors": [...]}
    Raises RuntimeError if the sweep request itself fails.
    """
    url = "/api/v1/regtest/sweep"
    headers = {"Authorization": f"Bearer {admin_token}"}
    log.info("Pre-run sweep: calling DELETE /api/v1/regtest/sweep ...")
    try:
        with httpx.Client(base_url=BASE_URL, timeout=max(REQUEST_TIMEOUT, 60)) as client:
            resp = client.delete(url, headers=headers)
    except Exception as exc:
        raise RuntimeError(f"Pre-run sweep request failed: {exc}")

    if resp.status_code == 403:
        raise RuntimeError("Pre-run sweep: 403 — token does not have admin access")
    if resp.status_code not in (200, 204):
        raise RuntimeError(
            f"Pre-run sweep: unexpected status {resp.status_code} — {resp.text[:300]}"
        )

    result = resp.json() if resp.content else {"deleted": {}, "total": 0, "errors": []}
    total = result.get("total", 0)
    errors = result.get("errors", [])

    if total:
        log.warning(f"Pre-run sweep: removed {total} orphaned [REGTEST] record(s)")
    else:
        log.info("Pre-run sweep: database clean — no orphaned test data found")

    if errors:
        for e in errors:
            log.warning(f"  sweep error: {e}")

    return result


# ── Module-level singleton — shared via conftest fixture ───────────────────────

_global_registry: Optional[CleanupRegistry] = None


def get_registry() -> CleanupRegistry:
    """Return the module-level CleanupRegistry, creating it if needed."""
    global _global_registry
    if _global_registry is None:
        _global_registry = CleanupRegistry()
    return _global_registry
