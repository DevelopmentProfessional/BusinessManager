import pytest
from fastapi import HTTPException

from backend import main


class _Connection:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, statement):
        assert str(statement) == "SELECT 1"


def test_staff_api_health_returns_ok_when_database_is_available(monkeypatch):
    monkeypatch.setattr(main.engine, "connect", lambda: _Connection())

    assert main.health() == {"status": "ok", "service": "staff-api"}


def test_staff_api_health_returns_503_when_database_is_unavailable(monkeypatch):
    def fail_connect():
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(main.engine, "connect", fail_connect)

    with pytest.raises(HTTPException) as exc_info:
        main.health()

    assert exc_info.value.status_code == 503
