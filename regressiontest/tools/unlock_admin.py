"""
unlock_admin.py — Diagnose and recover a locked admin account.

Run from the regressiontest/ directory:
    python tools/unlock_admin.py

What it does:
  1. Reads API_BASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD from .env
  2. Attempts to log in as admin
  3. If the account is locked, calculates remaining lock time and waits
  4. Retries until login succeeds or the budget is exhausted
  5. Prints a clear summary at the end
"""
import sys
import os
import time
import math

# Ensure regressiontest/ is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import httpx
from dotenv import load_dotenv

# ── Load environment ──────────────────────────────────────────────────────────
_env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
load_dotenv(_env_path)

BASE_URL     = os.getenv("API_BASE_URL", "https://businessmanager-reference-api.onrender.com")
ADMIN_USER   = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASS   = os.getenv("ADMIN_PASSWORD", "")
TIMEOUT      = int(os.getenv("REQUEST_TIMEOUT", "30"))
MAX_WAIT     = 35 * 60   # 35 minutes (lock is 30 min, buffer for clock skew)
POLL_EVERY   = 30        # seconds between retry attempts while waiting


def _try_login() -> tuple[bool, str]:
    """
    Try to log in.  Returns (success: bool, message: str).
    """
    try:
        with httpx.Client(timeout=TIMEOUT) as c:
            resp = c.post(
                f"{BASE_URL}/api/v1/auth/login",
                json={"username": ADMIN_USER, "password": ADMIN_PASS},
            )
    except httpx.ConnectError as e:
        return False, f"Cannot reach API at {BASE_URL}: {e}"
    except httpx.TimeoutException:
        return False, f"Request timed out ({TIMEOUT}s) — Render may be cold-starting. Try again."

    if resp.status_code == 200:
        data = resp.json()
        token = data.get("access_token") or data.get("token")
        if token:
            return True, "Login successful"
        return False, f"Unexpected response shape (no token): {data}"

    body_text = resp.text[:300]
    if resp.status_code == 401:
        if "locked" in body_text.lower():
            return False, f"LOCKED — {body_text}"
        return False, f"Wrong credentials (401): {body_text}"

    return False, f"Unexpected status {resp.status_code}: {body_text}"


def main():
    print("=" * 60)
    print("  BusinessManager — Admin Account Unlock Tool")
    print("=" * 60)
    print(f"  API:   {BASE_URL}")
    print(f"  User:  {ADMIN_USER}")
    if not ADMIN_PASS:
        print("\n  ERROR: ADMIN_PASSWORD is not set in .env")
        print("  Copy .env.template to .env and fill in your password.")
        sys.exit(1)
    print()

    # ── First attempt ─────────────────────────────────────────────────────────
    ok, msg = _try_login()
    if ok:
        print(f"  [OK] {msg}")
        print("\n  Admin account is healthy -- no action needed.")
        sys.exit(0)

    print(f"  [FAIL] {msg}")

    if "LOCKED" not in msg:
        # Not a lock issue — could be wrong password, network error, etc.
        print()
        print("  This is NOT a lock issue.  Check your .env credentials and")
        print("  confirm the API is reachable before running tests.")
        sys.exit(1)

    # ── Account is locked — wait for auto-expiry ─────────────────────────────
    print()
    print("  The admin account is locked (too many failed login attempts).")
    print("  Render's lock expires automatically after 30 minutes.")
    print(f"  Waiting up to {MAX_WAIT // 60} minutes, polling every {POLL_EVERY}s ...")
    print()

    deadline   = time.time() + MAX_WAIT
    attempt    = 0

    while time.time() < deadline:
        remaining = math.ceil(deadline - time.time())
        mins, secs = divmod(remaining, 60)
        print(f"  [{attempt:>2}] Waiting ... {mins}m {secs:02d}s left. Sleeping {POLL_EVERY}s ...")
        time.sleep(POLL_EVERY)

        attempt += 1
        ok, msg = _try_login()
        if ok:
            print(f"\n  [OK] {msg}")
            print("\n  Admin account is now unlocked and healthy.")
            print("\n  Root cause: test_login_wrong_password was using the real admin username.")
            print("  This has been fixed in test_auth.py -- future runs won't lock the account.")
            sys.exit(0)

        print(f"      -> {msg}")

    print()
    print("  [FAIL] Admin account still locked after waiting 35 minutes.")
    print("  Something unexpected is wrong.  Check the Render dashboard")
    print("  and verify ADMIN_PASSWORD in your .env is correct.")
    sys.exit(1)


if __name__ == "__main__":
    main()
