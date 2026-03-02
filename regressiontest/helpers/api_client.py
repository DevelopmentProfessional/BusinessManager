"""
api_client.py — AuthedClient wrapping httpx.Client with Bearer token injection.
"""
import httpx
from typing import Any, Optional
from config import BASE_URL, REQUEST_TIMEOUT


class AuthedClient:
    """
    Thin wrapper around httpx.Client that injects an Authorization header
    and prefixes all paths with BASE_URL.

    Usage:
        client = AuthedClient(token="eyJ...")
        resp = client.get("/api/v1/isud/clients")
        resp = client.post("/api/v1/isud/clients", json={...})
    """

    def __init__(self, token: Optional[str] = None, timeout: int = REQUEST_TIMEOUT):
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self._client = httpx.Client(
            base_url=BASE_URL,
            headers=headers,
            timeout=timeout,
            follow_redirects=True,
        )

    # ── Forwarded HTTP verbs ────────────────────────────────────────────────

    def get(self, path: str, **kwargs) -> httpx.Response:
        return self._client.get(path, **kwargs)

    def post(self, path: str, **kwargs) -> httpx.Response:
        return self._client.post(path, **kwargs)

    def put(self, path: str, **kwargs) -> httpx.Response:
        return self._client.put(path, **kwargs)

    def patch(self, path: str, **kwargs) -> httpx.Response:
        return self._client.patch(path, **kwargs)

    def delete(self, path: str, **kwargs) -> httpx.Response:
        return self._client.delete(path, **kwargs)

    def close(self) -> None:
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


def login(username: str, password: str) -> str:
    """Perform a login and return the access token string."""
    with httpx.Client(base_url=BASE_URL, timeout=REQUEST_TIMEOUT) as c:
        resp = c.post(
            "/api/v1/auth/login",
            json={"username": username, "password": password},
        )
    if resp.status_code != 200:
        raise RuntimeError(
            f"Login failed for {username!r}: {resp.status_code} — {resp.text[:300]}"
        )
    data = resp.json()
    token = data.get("access_token") or data.get("token")
    if not token:
        raise RuntimeError(f"No token in login response: {data}")
    return token
