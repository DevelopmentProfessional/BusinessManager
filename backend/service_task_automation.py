"""Validation and materialization of service task automation rules."""

import json
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlmodel import Session, select

from .models import Schedule, Service, Task, User


_TIMINGS = {"before", "during", "after"}
_PRIORITIES = {"low", "medium", "high"}
_ASSIGNMENT_POLICIES = {"appointment_employee", "specific_employee"}
_MAX_OFFSET_MINUTES = 525_600


def normalize_service_task_automation(
    raw_value: Any,
    session: Session,
    company_id: str,
) -> str | None:
    """Validate service task rules and store them as normalized JSON."""
    if raw_value is None:
        return None

    try:
        rules = json.loads(raw_value) if isinstance(raw_value, str) else raw_value
    except (TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Task automation must be valid JSON.") from exc

    if not isinstance(rules, list):
        raise HTTPException(status_code=400, detail="Task automation must be a list of rules.")

    normalized_rules = []
    seen_ids = set()
    for index, rule in enumerate(rules):
        if not isinstance(rule, dict):
            raise HTTPException(status_code=400, detail=f"Task rule {index + 1} must be an object.")

        rule_id = str(rule.get("id") or uuid4()).strip()
        title = str(rule.get("title") or "").strip()
        description = rule.get("description") or ""
        timing = str(rule.get("timing") or "during").strip().lower()
        priority = str(rule.get("priority") or "medium").strip().lower()
        assignment_policy = str(rule.get("assignment_policy") or "appointment_employee").strip()
        raw_offset = rule.get("offset_minutes", 0)

        if not rule_id or rule_id in seen_ids:
            raise HTTPException(status_code=400, detail="Task rule IDs must be unique and non-empty.")
        seen_ids.add(rule_id)
        if not title or len(title) > 200:
            raise HTTPException(status_code=400, detail=f"Task rule {index + 1} needs a title of 1–200 characters.")
        if not isinstance(description, str) or len(description) > 4000:
            raise HTTPException(status_code=400, detail=f"Task rule {index + 1} description is invalid.")
        if timing not in _TIMINGS:
            raise HTTPException(status_code=400, detail=f"Task rule {index + 1} has an invalid timing.")
        if priority not in _PRIORITIES:
            raise HTTPException(status_code=400, detail=f"Task rule {index + 1} has an invalid priority.")
        if assignment_policy not in _ASSIGNMENT_POLICIES:
            raise HTTPException(status_code=400, detail=f"Task rule {index + 1} has an invalid assignment policy.")

        try:
            offset_value = float(raw_offset)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=f"Task rule {index + 1} offset must be a whole number.") from exc
        if isinstance(raw_offset, bool) or not offset_value.is_integer():
            raise HTTPException(status_code=400, detail=f"Task rule {index + 1} offset must be a whole number.")
        offset_minutes = int(offset_value)
        if not 0 <= offset_minutes <= _MAX_OFFSET_MINUTES:
            raise HTTPException(status_code=400, detail=f"Task rule {index + 1} offset is out of range.")

        assigned_to_id = None
        if assignment_policy == "specific_employee":
            try:
                assigned_to_id = UUID(str(rule.get("assigned_to_id")))
            except (TypeError, ValueError) as exc:
                raise HTTPException(status_code=400, detail=f"Task rule {index + 1} must select an employee.") from exc
            employee = session.get(User, assigned_to_id)
            if (
                not employee
                or employee.company_id != company_id
                or not employee.is_active
            ):
                raise HTTPException(status_code=400, detail=f"Task rule {index + 1} selected an unavailable employee.")

        normalized_rules.append({
            "id": rule_id,
            "title": title,
            "description": description.strip(),
            "priority": priority,
            "timing": timing,
            "offset_minutes": offset_minutes,
            "assignment_policy": assignment_policy,
            "assigned_to_id": str(assigned_to_id) if assigned_to_id else None,
        })

    return json.dumps(normalized_rules, separators=(",", ":"))


def _due_date_for_rule(schedule: Schedule, rule: dict[str, Any]):
    appointment_date = schedule.appointment_date
    offset = timedelta(minutes=rule["offset_minutes"])
    if rule["timing"] == "before":
        return appointment_date - offset
    if rule["timing"] == "after":
        return appointment_date + offset
    return appointment_date


def _task_description(service: Service, schedule: Schedule, rule: dict[str, Any]) -> str:
    context = f"Service: {service.name}\nAppointment: {schedule.appointment_date.isoformat()}"
    return "\n\n".join(part for part in (rule["description"], context) if part)


def sync_service_automation_tasks(
    session: Session,
    schedule: Schedule,
    company_id: str,
    *,
    was_cancelled: bool = False,
) -> None:
    """Create or reconcile pending generated tasks for a scheduled service."""
    if not schedule.id:
        return

    if isinstance(schedule.appointment_date, str):
        try:
            schedule.appointment_date = datetime.fromisoformat(schedule.appointment_date)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Schedule appointment_date must be a valid datetime.") from exc
    if not isinstance(schedule.appointment_date, datetime):
        raise HTTPException(status_code=400, detail="Schedule appointment_date must be a valid datetime.")

    session.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:schedule_id))"),
        {"schedule_id": str(schedule.id)},
    )
    existing_tasks = session.exec(
        select(Task).where(
            Task.source_schedule_id == schedule.id,
            Task.company_id == company_id,
        )
    ).all()

    if str(schedule.status or "").lower() == "cancelled":
        for task in existing_tasks:
            if task.status == "pending":
                task.status = "cancelled"
                session.add(task)
        return

    if str(schedule.status or "").lower() == "completed":
        return

    service = session.get(Service, schedule.service_id) if schedule.service_id else None
    if (
        not service
        or service.company_id != company_id
        or str(schedule.task_type or "service").lower() != "service"
    ):
        rules = []
    else:
        try:
            rules = json.loads(service.task_automation_json or "[]")
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=409,
                detail="The service has invalid task automation data. Edit and save its task rules before booking.",
            ) from exc
        if not isinstance(rules, list):
            raise HTTPException(
                status_code=409,
                detail="The service task automation data is invalid. Edit and save its task rules before booking.",
            )

    rules_by_id = {str(rule["id"]): rule for rule in rules if isinstance(rule, dict) and rule.get("id")}
    existing_by_rule = {task.automation_rule_id: task for task in existing_tasks if task.automation_rule_id}

    for rule_id, task in existing_by_rule.items():
        if rule_id not in rules_by_id:
            if task.status == "pending":
                task.status = "cancelled"
                session.add(task)
            continue
        if was_cancelled and task.status == "cancelled":
            task.status = "pending"
        if task.status != "pending":
            continue
        rule = rules_by_id[rule_id]
        task.title = rule["title"]
        task.description = _task_description(service, schedule, rule)
        task.priority = rule["priority"]
        task.due_date = _due_date_for_rule(schedule, rule)
        task.assigned_to_id = (
            UUID(rule["assigned_to_id"])
            if rule["assignment_policy"] == "specific_employee" and rule.get("assigned_to_id")
            else schedule.employee_id
        )
        task.action_path = "/schedule"
        session.add(task)

    if not service or service.company_id != company_id or str(schedule.task_type or "service").lower() != "service":
        return

    for rule_id, rule in rules_by_id.items():
        if rule_id in existing_by_rule:
            continue
        assigned_to_id = (
            UUID(rule["assigned_to_id"])
            if rule["assignment_policy"] == "specific_employee" and rule.get("assigned_to_id")
            else schedule.employee_id
        )
        session.add(Task(
            title=rule["title"],
            description=_task_description(service, schedule, rule),
            status="pending",
            priority=rule["priority"],
            due_date=_due_date_for_rule(schedule, rule),
            assigned_to_id=assigned_to_id,
            action_path="/schedule",
            source_schedule_id=schedule.id,
            automation_rule_id=rule_id,
            company_id=company_id,
        ))
