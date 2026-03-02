"""
assertions.py — Shared assertion helpers for the regression test suite.
"""
import httpx
from typing import Any, Optional


def _req_detail(resp: httpx.Response) -> str:
    """Format full request + response info for failure messages."""
    lines = [
        f"  Request : {resp.request.method} {resp.request.url}",
    ]
    try:
        body = resp.request.content
        if body:
            lines.append(f"  Sent    : {body.decode('utf-8', errors='replace')[:1000]}")
    except Exception:
        pass
    lines.append(f"  Response: {resp.text[:2000]}")
    return "\n".join(lines)


def assert_status(resp: httpx.Response, expected: int, context: str = "") -> dict:
    """Assert HTTP status code and return parsed JSON body."""
    ctx = f" [{context}]" if context else ""
    assert resp.status_code == expected, (
        f"Expected {expected}, got {resp.status_code}{ctx}\n"
        + _req_detail(resp)
    )
    try:
        return resp.json()
    except Exception:
        return {}


def assert_ok(resp: httpx.Response, context: str = "") -> dict:
    """Assert 200 OK and return JSON body."""
    return assert_status(resp, 200, context)


def assert_created(resp: httpx.Response, context: str = "") -> dict:
    """Assert 200 or 201 (creation) and return JSON body."""
    ctx = f" [{context}]" if context else ""
    assert resp.status_code in (200, 201), (
        f"Expected 200/201, got {resp.status_code}{ctx}\n"
        + _req_detail(resp)
    )
    try:
        return resp.json()
    except Exception:
        return {}


def assert_permission_denied(resp: httpx.Response, context: str = "") -> None:
    """Assert 401 or 403 (permission denied)."""
    ctx = f" [{context}]" if context else ""
    assert resp.status_code in (401, 403), (
        f"Expected 401/403 (permission denied), got {resp.status_code}{ctx}\n"
        + _req_detail(resp)
    )


def assert_not_found(resp: httpx.Response, context: str = "") -> None:
    """Assert 404 Not Found."""
    assert_status(resp, 404, context)


def assert_schema(data: dict, required_fields: list, context: str = "") -> None:
    """Assert that a dict contains all required fields."""
    ctx = f" [{context}]" if context else ""
    missing = [f for f in required_fields if f not in data]
    assert not missing, f"Missing fields in response{ctx}: {missing}\nGot: {list(data.keys())}"


def assert_list_response(data: Any, context: str = "") -> list:
    """Assert response is a non-empty list and return it."""
    ctx = f" [{context}]" if context else ""
    assert isinstance(data, list), f"Expected list response{ctx}, got {type(data).__name__}: {data!r}"
    return data


def assert_permission_matrix(client_factory, matrix: dict) -> None:
    """
    Run a permission matrix check.

    matrix format:
        {
            "METHOD /path": {
                "admin": 200, "manager": 200, "employee": 403, "viewer": 200
            }
        }
    client_factory: dict mapping role name → AuthedClient
    """
    failures = []
    for endpoint, role_expectations in matrix.items():
        method_str, path = endpoint.split(" ", 1)
        method = method_str.lower()
        for role, expected_status in role_expectations.items():
            client = client_factory.get(role)
            if client is None:
                failures.append(f"  No client for role {role!r}")
                continue
            try:
                resp = getattr(client, method)(path)
                actual = resp.status_code
                if actual != expected_status:
                    failures.append(
                        f"  {method_str} {path} as {role}: expected {expected_status}, got {actual}"
                    )
            except Exception as exc:
                failures.append(f"  {method_str} {path} as {role}: exception {exc}")
    if failures:
        raise AssertionError("Permission matrix failures:\n" + "\n".join(failures))
