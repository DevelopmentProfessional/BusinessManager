from datetime import datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.models import Attendance, AttendanceStatusRead, UserRole
from backend.routers import auth


class _Result:
    def __init__(self, value):
        self.value = value

    def first(self):
        return self.value

    def all(self):
        return self.value


class _AttendanceSession:
    def __init__(self, *results):
        self.results = list(results)
        self.added = []
        self.commit_count = 0
        self.refresh_count = 0

    def exec(self, _statement):
        return _Result(self.results.pop(0))

    def add(self, record):
        self.added.append(record)

    def commit(self):
        self.commit_count += 1

    def refresh(self, _record):
        self.refresh_count += 1


def _admin_user(company_id="company-a"):
    return SimpleNamespace(id=uuid4(), role=UserRole.ADMIN, company_id=company_id)


def test_clock_in_creates_a_company_scoped_attendance_record():
    user = _admin_user()
    session = _AttendanceSession(None)

    record = auth.clock_in_attendance(user, session)

    assert record.user_id == user.id
    assert record.company_id == user.company_id
    assert record.clock_in is not None
    assert record.date == record.clock_in
    assert session.added == [record]
    assert session.commit_count == 1
    assert session.refresh_count == 1


def test_clock_in_reuses_an_existing_open_record():
    user = _admin_user()
    open_record = Attendance(user_id=user.id, company_id=user.company_id, date=datetime.utcnow(), clock_in=datetime.utcnow())
    session = _AttendanceSession(open_record)

    result = auth.clock_in_attendance(user, session)

    assert result is open_record
    assert session.added == []
    assert session.commit_count == 0


def test_clock_out_closes_the_open_record_and_calculates_hours():
    user = _admin_user()
    clock_in = datetime.utcnow() - timedelta(hours=1, minutes=30)
    open_record = Attendance(user_id=user.id, company_id=user.company_id, date=clock_in, clock_in=clock_in)
    session = _AttendanceSession(open_record)

    result = auth.clock_out_attendance(user, session)

    assert result is open_record
    assert result.clock_out is not None
    assert result.total_hours == 1.5
    assert session.commit_count == 1
    assert session.refresh_count == 1


def test_clock_out_requires_an_open_record():
    user = _admin_user()
    session = _AttendanceSession(None)

    with pytest.raises(HTTPException) as error:
        auth.clock_out_attendance(user, session)

    assert error.value.status_code == 409
    assert error.value.detail == "You are not currently clocked in"


def test_attendance_status_restores_an_open_shift_and_today_total():
    user = _admin_user()
    now = datetime.utcnow()
    open_record = Attendance(
        user_id=user.id,
        company_id=user.company_id,
        date=now - timedelta(days=1),
        clock_in=now - timedelta(days=1),
    )
    completed_record = Attendance(
        user_id=user.id,
        company_id=user.company_id,
        date=now,
        clock_in=now - timedelta(hours=3),
        clock_out=now - timedelta(hours=2),
        total_hours=1.0,
    )
    session = _AttendanceSession(open_record, [completed_record])

    result = auth.get_current_attendance_status(user, session)

    assert isinstance(result, AttendanceStatusRead)
    assert result.is_clocked_in is True
    assert result.current_record.id == open_record.id
    assert result.today_hours == 1.0
