import asyncio
import json
from datetime import datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.models import Schedule, Service, Task, User
from backend.routers import isud
from backend.routers.tasks import TaskStatusUpdate, update_my_task_status
from backend.service_task_automation import (
    normalize_service_task_automation,
    sync_service_automation_tasks,
)


class _Result:
    def __init__(self, values):
        self.values = values

    def all(self):
        return self.values

    def first(self):
        return self.values[0] if self.values else None


class _AutomationSession:
    def __init__(self, service, employees=(), tasks=()):
        self.service = service
        self.employees = {employee.id: employee for employee in employees}
        self.tasks = list(tasks)
        self.added = []
        self.locked = False

    def get(self, model, record_id):
        if model is Service:
            return self.service if str(self.service.id) == str(record_id) else None
        if model is User:
            return self.employees.get(record_id)
        return None

    def execute(self, statement, parameters=None):
        assert "pg_advisory_xact_lock" in str(statement)
        assert parameters is not None
        self.locked = True

    def exec(self, _statement):
        return _Result([*self.tasks, *self.added])

    def add(self, value):
        if value not in self.added:
            self.added.append(value)


def _rule(**overrides):
    return {
        "id": "prepare-room",
        "title": "Prepare room",
        "description": "Set out towels",
        "priority": "high",
        "timing": "before",
        "offset_minutes": 30,
        "assignment_policy": "appointment_employee",
        **overrides,
    }


def test_normalize_service_task_automation_rejects_employee_from_another_company():
    company_employee = SimpleNamespace(id=uuid4(), company_id="other-company", is_active=True)
    service = Service(id=uuid4(), name="Room booking")
    session = _AutomationSession(service, employees=[company_employee])

    with pytest.raises(HTTPException) as error:
        normalize_service_task_automation(
            json.dumps([_rule(assignment_policy="specific_employee", assigned_to_id=str(company_employee.id))]),
            session,
            "company-a",
        )

    assert error.value.status_code == 400
    assert "unavailable employee" in error.value.detail


def test_normalize_service_task_automation_accepts_active_same_company_override():
    company_employee = SimpleNamespace(id=uuid4(), company_id="company-a", is_active=True)
    service = Service(id=uuid4(), name="Room booking")
    session = _AutomationSession(service, employees=[company_employee])

    normalized = normalize_service_task_automation(
        json.dumps([_rule(assignment_policy="specific_employee", assigned_to_id=str(company_employee.id))]),
        session,
        "company-a",
    )

    rule = json.loads(normalized)[0]
    assert rule["assignment_policy"] == "specific_employee"
    assert rule["assigned_to_id"] == str(company_employee.id)


def test_sync_creates_idempotent_task_with_due_date_and_appointment_assignee():
    company_id = "company-a"
    employee_id = uuid4()
    override_employee_id = uuid4()
    appointment_date = datetime(2026, 12, 1, 10, 0)
    override_rule = _rule(
        id="manager-review",
        title="Manager review",
        timing="after",
        offset_minutes=15,
        assignment_policy="specific_employee",
        assigned_to_id=str(override_employee_id),
    )
    service = Service(
        id=uuid4(),
        name="Room booking",
        task_automation_json=json.dumps([_rule(), override_rule]),
        company_id=company_id,
    )
    schedule = Schedule(
        id=uuid4(),
        service_id=service.id,
        task_type="service",
        employee_id=employee_id,
        appointment_date=appointment_date,
        company_id=company_id,
    )
    session = _AutomationSession(service)

    sync_service_automation_tasks(session, schedule, company_id)
    sync_service_automation_tasks(session, schedule, company_id)

    assert session.locked
    assert len(session.added) == 2
    tasks_by_rule = {task.automation_rule_id: task for task in session.added}
    default_task = tasks_by_rule["prepare-room"]
    override_task = tasks_by_rule["manager-review"]
    assert default_task.source_schedule_id == schedule.id
    assert default_task.assigned_to_id == employee_id
    assert default_task.due_date == appointment_date - timedelta(minutes=30)
    assert default_task.priority == "high"
    assert override_task.assigned_to_id == override_employee_id
    assert override_task.due_date == appointment_date + timedelta(minutes=15)


def test_sync_reschedules_pending_tasks_and_cancels_only_pending_tasks():
    company_id = "company-a"
    employee_id = uuid4()
    rule = _rule(timing="after", offset_minutes=45)
    service = Service(
        id=uuid4(),
        name="Room booking",
        task_automation_json=json.dumps([rule]),
        company_id=company_id,
    )
    schedule = Schedule(
        id=uuid4(),
        service_id=service.id,
        task_type="service",
        employee_id=employee_id,
        appointment_date=datetime(2026, 12, 1, 10, 0),
        company_id=company_id,
    )
    pending_task = Task(
        id=uuid4(),
        title="Old title",
        status="pending",
        source_schedule_id=schedule.id,
        automation_rule_id=rule["id"],
        company_id=company_id,
    )
    in_progress_task = Task(
        id=uuid4(),
        title="Started task",
        status="in_progress",
        source_schedule_id=schedule.id,
        automation_rule_id="started-rule",
        company_id=company_id,
    )
    session = _AutomationSession(service, tasks=[pending_task, in_progress_task])
    schedule.appointment_date = datetime(2026, 12, 1, 11, 0)

    sync_service_automation_tasks(session, schedule, company_id)

    assert pending_task.due_date == datetime(2026, 12, 1, 11, 45)
    assert pending_task.title == "Prepare room"
    assert in_progress_task.status == "in_progress"

    schedule.status = "cancelled"
    sync_service_automation_tasks(session, schedule, company_id)

    assert pending_task.status == "cancelled"
    assert in_progress_task.status == "in_progress"


def test_assignee_can_start_own_task():
    employee_id = uuid4()
    task = Task(
        id=uuid4(),
        title="Prepare room",
        status="pending",
        assigned_to_id=employee_id,
        company_id="company-a",
    )
    task.linked_tasks = []

    class Session:
        def exec(self, _statement):
            return _Result([task])

        def add(self, _value):
            return None

        def commit(self):
            return None

        def refresh(self, _value):
            return None

    result = asyncio.run(
        update_my_task_status(
            task.id,
            TaskStatusUpdate(status="in_progress"),
            Session(),
            SimpleNamespace(id=employee_id, company_id="company-a"),
        )
    )

    assert task.status == "in_progress"
    assert result.status == "in_progress"


def test_standard_schedule_insert_invokes_task_automation(monkeypatch):
    employee_id = uuid4()
    appointment_date = datetime(2026, 12, 1, 10, 0)
    service = Service(
        id=uuid4(),
        name="Room booking",
        task_automation_json=json.dumps([_rule()]),
        company_id="company-a",
    )

    class Session:
        def __init__(self):
            self.tasks = []

        def get(self, model, record_id):
            if model is Service and str(service.id) == str(record_id):
                return service
            return None

        def execute(self, _statement, parameters=None):
            assert parameters is not None

        def exec(self, _statement):
            return _Result(self.tasks)

        def add(self, value):
            if isinstance(value, Task):
                self.tasks.append(value)

        def flush(self):
            return None

        def commit(self):
            return None

        def refresh(self, _value):
            return None

    monkeypatch.setattr(isud, "get_model_class", lambda _table_name: Schedule)
    monkeypatch.setattr(isud, "_guard_managed_inventory_table", lambda _model: None)
    monkeypatch.setattr(isud, "_require_isud_permission", lambda *_args: None)
    monkeypatch.setattr(isud, "_sanitize_contact_verification_fields", lambda *_args: None)
    monkeypatch.setattr(isud, "_record_undo_action", lambda **_kwargs: None)
    monkeypatch.setattr(
        isud,
        "_serialize_record",
        lambda record, *_args: {"id": str(record.id)},
    )
    session = Session()

    result = asyncio.run(
        isud.insert(
            "schedule",
            {
                "employee_id": str(employee_id),
                "service_id": str(service.id),
                "appointment_date": appointment_date.isoformat(),
            },
            None,
            session,
            SimpleNamespace(company_id="company-a", id=uuid4()),
        )
    )

    assert result["id"]
    assert len(session.tasks) == 1
    assert session.tasks[0].due_date == appointment_date - timedelta(minutes=30)
    assert session.tasks[0].assigned_to_id == str(employee_id)
