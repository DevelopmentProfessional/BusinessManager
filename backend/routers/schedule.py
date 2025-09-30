from fastapi import APIRouter, Depends, HTTPException
import traceback
from sqlmodel import Session, select
from typing import List
from uuid import UUID
from backend.database import get_session
from backend.models import Schedule, ScheduleCreate, ScheduleRead, User, UserRole, UserPermission
from backend.routers.auth import get_current_user, get_user_permissions_list
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

router = APIRouter()

# Cache for detected FK target to avoid repeated information_schema queries
_SCHEDULE_EMPLOYEE_FK_TARGET = None  # 'user' or 'employee' or None if undetected

def _detect_schedule_employee_fk_target(session: Session) -> str:
    global _SCHEDULE_EMPLOYEE_FK_TARGET
    if _SCHEDULE_EMPLOYEE_FK_TARGET:
        return _SCHEDULE_EMPLOYEE_FK_TARGET
    try:
        # Query information_schema to determine what 'schedule.employee_id' references
        sql = text(
            """
            SELECT ccu.table_name AS foreign_table_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
             AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = 'schedule'
              AND kcu.column_name = 'employee_id'
            LIMIT 1
            """
        )
        result = session.exec(sql).first()
        if result and result[0] in ("user", "employee"):
            _SCHEDULE_EMPLOYEE_FK_TARGET = result[0]
            print(f"[Schedule] Detected FK target for schedule.employee_id -> {_SCHEDULE_EMPLOYEE_FK_TARGET}")
            return _SCHEDULE_EMPLOYEE_FK_TARGET
    except Exception as e:
        print(f"[Schedule] FK target detection failed: {e}")
    # Default to 'user' if unknown (matches current models)
    _SCHEDULE_EMPLOYEE_FK_TARGET = "user"
    return _SCHEDULE_EMPLOYEE_FK_TARGET

@router.get("/schedule", response_model=List[ScheduleRead])
async def get_schedule(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get appointments based on user permissions"""
    try:
        # Get user permissions
        permissions = get_user_permissions_list(current_user, session)
        
        # Admin users can see all appointments
        if current_user.role == UserRole.ADMIN or any(perm.startswith("schedule:admin") for perm in permissions):
            appointments = session.exec(select(Schedule)).all()
            # Convert to ScheduleRead objects to avoid relationship serialization issues
            return [
                ScheduleRead(
                    id=apt.id,
                    created_at=apt.created_at,
                    updated_at=apt.updated_at,
                    client_id=apt.client_id,
                    service_id=apt.service_id,
                    employee_id=apt.employee_id,
                    appointment_date=apt.appointment_date,
                    status=apt.status,
                    notes=apt.notes
                ) for apt in appointments
            ]
        
        # Check if user has view_all permission
        if any(perm.startswith("schedule:view_all") for perm in permissions):
            appointments = session.exec(select(Schedule)).all()
            # Convert to ScheduleRead objects to avoid relationship serialization issues
            return [
                ScheduleRead(
                    id=apt.id,
                    created_at=apt.created_at,
                    updated_at=apt.updated_at,
                    client_id=apt.client_id,
                    service_id=apt.service_id,
                    employee_id=apt.employee_id,
                    appointment_date=apt.appointment_date,
                    status=apt.status,
                    notes=apt.notes
                ) for apt in appointments
            ]
        
        # Check if user has basic schedule read permission (read or read_all)
        if any(perm.startswith("schedule:read") for perm in permissions) or any(perm.startswith("schedule:read_all") for perm in permissions):
            # Only show appointments for the current user
            appointments = session.exec(
                select(Schedule).where(Schedule.employee_id == current_user.id)
            ).all()
            # Convert to ScheduleRead objects to avoid relationship serialization issues
            return [
                ScheduleRead(
                    id=apt.id,
                    created_at=apt.created_at,
                    updated_at=apt.updated_at,
                    client_id=apt.client_id,
                    service_id=apt.service_id,
                    employee_id=apt.employee_id,
                    appointment_date=apt.appointment_date,
                    status=apt.status,
                    notes=apt.notes
                ) for apt in appointments
            ]
        
        # No permissions - return empty list
        return []
        
    except Exception as e:
        print(f"Schedule endpoint error: {e}")
        import traceback
        traceback.print_exc()
        # Return empty list on error to prevent 500
        return []

@router.get("/schedule/employee/{employee_id}", response_model=List[ScheduleRead])
async def get_employee_schedule(
    employee_id: UUID, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get schedule for a specific employee (requires view_all permission)"""
    # Get user permissions
    permissions = get_user_permissions_list(current_user, session)
    
    # Check permissions
    if current_user.role != UserRole.ADMIN and not any(perm.startswith("schedule:view_all") for perm in permissions):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    statement = select(Schedule).where(Schedule.employee_id == employee_id)
    appointments = session.exec(statement).all()
    return appointments

@router.get("/schedule/employees", response_model=List[dict])
async def get_available_employees(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get list of employees available for scheduling based on user permissions.

    Dynamically returns the correct identifier based on schedule.employee_id FK target:
    - If FK -> user.id, "id" is user.id
    - If FK -> employee.id, "id" is employee.id (with name from joined user)
    """
    # Get user permissions
    permissions = get_user_permissions_list(current_user, session)

    # Determine FK target for schedule.employee_id
    fk_target = _detect_schedule_employee_fk_target(session)

    # Check permissions for employee dropdown access
    has_write_all = any(perm == "schedule:write_all" for perm in permissions)  # Legacy support
    has_view_all = any(perm == "schedule:view_all" for perm in permissions)    # New permission
    has_admin = any(perm == "schedule:admin" for perm in permissions)
    is_admin = current_user.role == UserRole.ADMIN

    # Helper to list all employees according to FK target
    def list_all():
        if fk_target == "employee":
            try:
                rows = session.exec(text(
                    'SELECT e.id, u.first_name, u.last_name, u.is_active '\
                    'FROM employee e JOIN "user" u ON u.id = e.user_id'
                )).all()
                return [
                    {
                        "id": str(row[0]),
                        "name": f"{row[1]} {row[2]}",
                        "is_active": bool(row[3])
                    }
                    for row in rows if row[3]
                ]
            except Exception as e:
                print(f"[Schedule] Failed to list employees from legacy table: {e}")
                # Fallback to users list
        # Default: fk -> user
        users = session.exec(select(User)).all()
        return [
            {
                "id": str(user.id),
                "name": f"{user.first_name} {user.last_name}",
                "is_active": user.is_active
            }
            for user in users if user.is_active
        ]

    if is_admin or has_write_all or has_view_all or has_admin:
        return list_all()
    else:
        # Users with only basic write permission can only see themselves
        if fk_target == "employee":
            try:
                row = session.exec(text(
                    'SELECT e.id FROM employee e WHERE e.user_id = :uid LIMIT 1'
                ), {"uid": str(current_user.id)}).first()
                if row and row[0]:
                    return [{
                        "id": str(row[0]),
                        "name": f"{current_user.first_name} {current_user.last_name}",
                        "is_active": current_user.is_active
                    }]
            except Exception as e:
                print(f"[Schedule] Self list legacy mapping failed: {e}")
        # Fallback: return user id
        return [{
            "id": str(current_user.id),
            "name": f"{current_user.first_name} {current_user.last_name}",
            "is_active": current_user.is_active
        }]

@router.post("/schedule", response_model=ScheduleRead)
async def create_appointment(
    appointment_data: ScheduleCreate, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new appointment. Permission gating is handled in the UI before opening the modal."""
    try:
        # Normalize and validate payload
        payload = appointment_data.dict()

        # Basic presence validation
        required_fields = ["client_id", "service_id", "employee_id", "appointment_date"]
        missing = [f for f in required_fields if payload.get(f) in (None, "", [])]
        if missing:
            raise HTTPException(status_code=422, detail=f"Missing required fields: {', '.join(missing)}")

        # Normalize UUID-like fields that may arrive as strings
        from uuid import UUID as _UUID
        for key in ("client_id", "service_id", "employee_id"):
            val = payload.get(key)
            if isinstance(val, str):
                try:
                    payload[key] = _UUID(val)
                except Exception:
                    raise HTTPException(status_code=422, detail=f"Invalid {key}")

        # Normalize datetime
        from datetime import datetime
        dt_val = payload.get("appointment_date")
        if isinstance(dt_val, str):
            try:
                payload["appointment_date"] = datetime.fromisoformat(dt_val.replace('Z', '+00:00'))
            except ValueError:
                try:
                    payload["appointment_date"] = datetime.fromisoformat(dt_val)
                except Exception:
                    raise HTTPException(status_code=422, detail="Invalid appointment_date")

        # Try to bridge legacy schema differences for employee_id by inspecting FK target
        bridged_payload = dict(payload)
        fk_target = _detect_schedule_employee_fk_target(session)
        try:
            session.exec(text("SELECT 1 FROM employee LIMIT 1")).first()
            legacy_employee_table_exists = True
        except Exception:
            legacy_employee_table_exists = False

        if legacy_employee_table_exists and fk_target == "employee":
            # DB expects employee.id; convert user_id -> employee.id if possible
            try:
                found = session.exec(
                    text("SELECT id FROM employee WHERE user_id = :uid LIMIT 1"),
                    {"uid": str(bridged_payload["employee_id"])},
                ).first()
                if found and found[0]:
                    print(f"[Schedule] FK expects employee; mapping user -> employee: {bridged_payload['employee_id']} -> {found[0]}")
                    from uuid import UUID as _UUID
                    bridged_payload["employee_id"] = _UUID(found[0]) if isinstance(found[0], str) else found[0]
                else:
                    print("[Schedule] No employee found for provided user_id; proceeding without pre-bridge.")
            except Exception as pre_e:
                print(f"[Schedule] Pre-bridge user->employee failed: {pre_e}")

        appointment = Schedule(**bridged_payload)
        session.add(appointment)
        try:
            session.commit()
        except IntegrityError as ie:
            session.rollback()
            # Attempt legacy employee->user mapping if FK on employee_id fails
            err_msg = str(ie.orig) if getattr(ie, 'orig', None) else str(ie)
            if 'employee_id' in err_msg and 'foreign key' in err_msg.lower():
                try:
                    # First, attempt employee.id -> user_id mapping (schedule expects user.id)
                    result_user = session.exec(
                        text("SELECT user_id FROM employee WHERE id = :eid LIMIT 1"),
                        {"eid": str(appointment.employee_id)},
                    ).first()
                    if result_user and result_user[0]:
                        from uuid import UUID as _UUID
                        mapped_user_id = _UUID(result_user[0]) if isinstance(result_user[0], str) else result_user[0]
                        print(f"[Schedule] FK failed; trying employee.id -> user_id mapping: {appointment.employee_id} -> {mapped_user_id}")
                        appointment.employee_id = mapped_user_id
                        session.add(appointment)
                        session.commit()
                    else:
                        # Next, attempt user_id -> employee.id mapping (schedule expects employee.id)
                        result_emp = session.exec(
                            text("SELECT id FROM employee WHERE user_id = :uid LIMIT 1"),
                            {"uid": str(bridged_payload.get("employee_id"))},
                        ).first()
                        if result_emp and result_emp[0]:
                            from uuid import UUID as _UUID
                            mapped_emp_id = _UUID(result_emp[0]) if isinstance(result_emp[0], str) else result_emp[0]
                            print(f"[Schedule] FK failed; trying user_id -> employee.id mapping: {bridged_payload.get('employee_id')} -> {mapped_emp_id}")
                            appointment.employee_id = mapped_emp_id
                            session.add(appointment)
                            session.commit()
                        else:
                            raise HTTPException(status_code=422, detail="Invalid employee_id: no matching legacy mapping found")
                except HTTPException:
                    raise
                except Exception as map_exc:
                    print(f"[Schedule] Legacy mapping attempts failed: {map_exc}")
                    traceback.print_exc()
                    raise HTTPException(status_code=422, detail="Invalid employee_id or legacy mapping missing")
            else:
                # Bubble a helpful message instead of opaque 500
                raise HTTPException(status_code=400, detail="Failed to create appointment. Check client/service/employee IDs.")
        session.refresh(appointment)
        return appointment
    except HTTPException as he:
        print(f"[Schedule] Create appointment HTTP error: {he.status_code} - {he.detail}")
        traceback.print_exc()
        raise
    except Exception as e:
        print(f"[Schedule] Create appointment unexpected error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal error creating appointment")

@router.put("/schedule/{appointment_id}", response_model=ScheduleRead)
async def update_appointment(
    appointment_id: UUID, 
    appointment_data: dict, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update an appointment"""
    try:
        # Get user permissions
        permissions = get_user_permissions_list(current_user, session)
        
        # Check permissions
        has_write_all = any(perm == "schedule:write_all" for perm in permissions)  # Legacy support
        has_view_all = any(perm == "schedule:view_all" for perm in permissions)    # New permission
        has_write = any(perm == "schedule:write" for perm in permissions)
        has_admin = any(perm == "schedule:admin" for perm in permissions)
        is_admin = current_user.role == UserRole.ADMIN
        
        # Allow write_all (legacy), view_all (new), write, admin, or admin role
        if not (has_write_all or has_view_all or has_write or has_admin or is_admin):
            raise HTTPException(status_code=403, detail="Permission denied")
        
        appointment = session.get(Schedule, appointment_id)
        if not appointment:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        # If user only has write permission (not write_all/view_all), restrict to their own appointments
        if has_write and not has_write_all and not has_view_all and not has_admin and not is_admin:
            if appointment.employee_id != current_user.id:
                raise HTTPException(status_code=403, detail="Can only edit your own appointments")
        
        # Handle type conversion and legacy FK bridge for known fields
        for key, value in appointment_data.items():
            if hasattr(appointment, key):
                # Convert datetime string -> datetime
                if key == "appointment_date" and isinstance(value, str):
                    from datetime import datetime
                    try:
                        value = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    except ValueError:
                        value = datetime.fromisoformat(value)
                # Convert UUID strings -> UUID objects
                if key in {"client_id", "service_id", "employee_id"} and isinstance(value, str):
                    try:
                        from uuid import UUID as _UUID
                        value = _UUID(value)
                    except Exception:
                        raise HTTPException(status_code=422, detail=f"Invalid {key}")
                
                # If user only has write permission, prevent changing employee_id to someone else
                if key == "employee_id" and has_write and not has_write_all and not has_view_all and not has_admin and not is_admin:
                    if value != current_user.id:
                        raise HTTPException(status_code=403, detail="Cannot schedule appointments for other employees")

                # Bridge user_id -> employee.id if DB expects employee
                if key == "employee_id":
                    fk_target = _detect_schedule_employee_fk_target(session)
                    if fk_target == "employee":
                        try:
                            row = session.exec(text(
                                'SELECT id FROM employee WHERE user_id = :uid LIMIT 1'
                            ), {"uid": str(value)}).first()
                            if row and row[0]:
                                from uuid import UUID as _UUID
                                value = _UUID(row[0]) if isinstance(row[0], str) else row[0]
                            else:
                                raise HTTPException(status_code=422, detail="Invalid employee_id: no matching legacy mapping found")
                        except HTTPException:
                            raise
                        except Exception as e:
                            print(f"[Schedule] Update bridge user->employee failed: {e}")
                            raise HTTPException(status_code=422, detail="Invalid employee_id or legacy mapping missing")
                
                setattr(appointment, key, value)
        
        # Update the updated_at timestamp
        from datetime import datetime
        appointment.updated_at = datetime.utcnow()
        
        session.add(appointment)
        try:
            session.commit()
        except IntegrityError as ie:
            session.rollback()
            err_msg = str(ie.orig) if getattr(ie, 'orig', None) else str(ie)
            if 'employee_id' in err_msg and 'foreign key' in err_msg.lower():
                try:
                    # First attempt: employee.id -> user_id (schedule expects user.id)
                    result_user = session.exec(
                        text("SELECT user_id FROM employee WHERE id = :eid LIMIT 1"),
                        {"eid": str(appointment.employee_id)},
                    ).first()
                    if result_user and result_user[0]:
                        from uuid import UUID as _UUID
                        mapped_user_id = _UUID(result_user[0]) if isinstance(result_user[0], str) else result_user[0]
                        print(f"[Schedule] UPDATE FK failed; trying employee.id -> user_id mapping: {appointment.employee_id} -> {mapped_user_id}")
                        appointment.employee_id = mapped_user_id
                        session.add(appointment)
                        session.commit()
                    else:
                        # Second attempt: user_id -> employee.id (schedule expects employee.id)
                        result_emp = session.exec(
                            text("SELECT id FROM employee WHERE user_id = :uid LIMIT 1"),
                            {"uid": str(appointment.employee_id)},
                        ).first()
                        if result_emp and result_emp[0]:
                            from uuid import UUID as _UUID
                            mapped_emp_id = _UUID(result_emp[0]) if isinstance(result_emp[0], str) else result_emp[0]
                            print(f"[Schedule] UPDATE FK failed; trying user_id -> employee.id mapping: {appointment.employee_id} -> {mapped_emp_id}")
                            appointment.employee_id = mapped_emp_id
                            session.add(appointment)
                            session.commit()
                        else:
                            raise HTTPException(status_code=422, detail="Invalid employee_id: no matching legacy mapping found")
                except HTTPException:
                    raise
                except Exception as map_exc:
                    print(f"[Schedule] UPDATE legacy mapping attempts failed: {map_exc}")
                    traceback.print_exc()
                    raise HTTPException(status_code=422, detail="Invalid employee_id or legacy mapping missing")
            else:
                raise HTTPException(status_code=400, detail="Failed to update appointment. Check client/service/employee IDs.")

        session.refresh(appointment)
        return appointment

    except HTTPException as he:
        print(f"[Schedule] Update appointment HTTP error: {he.status_code} - {he.detail}")
        traceback.print_exc()
        raise
    except Exception as e:
        print(f"[Schedule] Update appointment unexpected error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error while updating appointment")
