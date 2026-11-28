from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

try:
    from backend.database import get_session
    from backend.models import (
        CompanyPaymentAccount,
        CompanyPaymentAccountCreate,
        CompanyPaymentAccountRead,
        CompanyPaymentAccountUpdate,
        EmployeePaymentMethod,
        PaymentMethodCreate,
        PaymentMethodRead,
        PaymentMethodUpdate,
        PaymentSplitUpdate,
        User,
        UserRole,
    )
    from backend.payment_security import encrypt_details, masked_last4, reject_prohibited_card_data
    from backend.routers.auth import get_current_user, get_user_permissions_list
except ModuleNotFoundError:
    from database import get_session
    from models import (
        CompanyPaymentAccount,
        CompanyPaymentAccountCreate,
        CompanyPaymentAccountRead,
        CompanyPaymentAccountUpdate,
        EmployeePaymentMethod,
        PaymentMethodCreate,
        PaymentMethodRead,
        PaymentMethodUpdate,
        PaymentSplitUpdate,
        User,
        UserRole,
    )
    from payment_security import encrypt_details, masked_last4, reject_prohibited_card_data
    from routers.auth import get_current_user, get_user_permissions_list

router = APIRouter()


def _company_id(user: User) -> str:
    return user.company_id or ""


def _is_admin(user: User) -> bool:
    return str(user.role).lower() == UserRole.ADMIN.value


def _can_manage_employee_methods(user: User, employee_id: UUID, session: Session) -> bool:
    if _is_admin(user):
        return True
    permissions = set(get_user_permissions_list(user, session))
    has_payment_permission = "payments:manage_payment_methods" in permissions or "payments:admin" in permissions
    return user.id == employee_id and has_payment_permission


def _can_manage_company_accounts(user: User, session: Session) -> bool:
    if _is_admin(user):
        return True
    return "payments:admin" in set(get_user_permissions_list(user, session))


def _validate_details(method_type: str, details: dict) -> None:
    if not isinstance(details, dict) or not details:
        raise HTTPException(status_code=422, detail="Payment details are required.")
    try:
        reject_prohibited_card_data(method_type, details)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _set_employee_default(session: Session, company_id: str, employee_id: UUID, selected_id: UUID) -> None:
    methods = session.exec(
        select(EmployeePaymentMethod).where(
            EmployeePaymentMethod.company_id == company_id,
            EmployeePaymentMethod.employee_id == employee_id,
        )
    ).all()
    for method in methods:
        method.is_default = method.id == selected_id


def _readiness(session: Session, employee_id: UUID, company_id: str) -> dict:
    methods = session.exec(
        select(EmployeePaymentMethod).where(
            EmployeePaymentMethod.company_id == company_id,
            EmployeePaymentMethod.employee_id == employee_id,
            EmployeePaymentMethod.status == "active",
        )
    ).all()
    accounts = session.exec(
        select(CompanyPaymentAccount).where(
            CompanyPaymentAccount.company_id == company_id,
            CompanyPaymentAccount.status == "active",
            CompanyPaymentAccount.is_default == True,  # noqa: E712
        )
    ).all()
    total = round(sum(float(method.payout_percentage or 0) for method in methods), 2)
    return {
        "ready": bool(methods and accounts and total == 100.0),
        "employee_methods_configured": bool(methods),
        "company_account_configured": bool(accounts),
        "allocation_percentage": total,
        "allocation_complete": total == 100.0,
        "live_transfer_enabled": False,
    }


@router.get("/payment-accounts/employee-methods", response_model=list[PaymentMethodRead])
def list_employee_methods(
    employee_id: UUID | None = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    target_id = employee_id or current_user.id
    if not _can_manage_employee_methods(current_user, target_id, session):
        raise HTTPException(status_code=403, detail="Payment method access is not permitted.")
    return session.exec(
        select(EmployeePaymentMethod).where(
            EmployeePaymentMethod.company_id == _company_id(current_user),
            EmployeePaymentMethod.employee_id == target_id,
        ).order_by(EmployeePaymentMethod.created_at)
    ).all()


@router.post("/payment-accounts/employee-methods", response_model=PaymentMethodRead)
def create_employee_method(
    data: PaymentMethodCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    target_id = data.employee_id or current_user.id
    if not _can_manage_employee_methods(current_user, target_id, session):
        raise HTTPException(status_code=403, detail="Payment method access is not permitted.")
    employee = session.get(User, target_id)
    if not employee or employee.company_id != _company_id(current_user):
        raise HTTPException(status_code=404, detail="Employee not found.")
    _validate_details(data.method_type, data.details)
    method = EmployeePaymentMethod(
        employee_id=target_id,
        company_id=_company_id(current_user),
        method_type=data.method_type,
        label=data.label.strip(),
        provider_name=data.provider_name,
        account_holder_name=data.account_holder_name,
        country_code=data.country_code,
        currency=data.currency.upper(),
        encrypted_details=encrypt_details(data.details),
        last4=masked_last4(data.details),
        status=data.status,
        is_default=data.is_default,
        payout_percentage=data.payout_percentage,
    )
    session.add(method)
    session.commit()
    session.refresh(method)
    if method.is_default:
        _set_employee_default(session, method.company_id, method.employee_id, method.id)
        session.commit()
    return method


@router.put("/payment-accounts/employee-methods/{method_id}", response_model=PaymentMethodRead)
def update_employee_method(
    method_id: UUID,
    data: PaymentMethodUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    method = session.get(EmployeePaymentMethod, method_id)
    if not method or method.company_id != _company_id(current_user):
        raise HTTPException(status_code=404, detail="Payment method not found.")
    if not _can_manage_employee_methods(current_user, method.employee_id, session):
        raise HTTPException(status_code=403, detail="Payment method access is not permitted.")
    values = data.model_dump(exclude_unset=True)
    details = values.pop("details", None)
    if details is not None:
        _validate_details(method.method_type, details)
        method.encrypted_details = encrypt_details(details)
        method.last4 = masked_last4(details)
    for key, value in values.items():
        setattr(method, key, value.upper() if key == "currency" and value else value)
    if method.status == "disabled":
        method.disabled_at = datetime.utcnow()
    if method.is_default:
        _set_employee_default(session, method.company_id, method.employee_id, method.id)
    method.updated_at = datetime.utcnow()
    session.add(method)
    session.commit()
    session.refresh(method)
    return method


@router.put("/payment-accounts/employee-methods/{employee_id}/allocations", response_model=dict)
def update_employee_allocations(
    employee_id: UUID,
    data: PaymentSplitUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not _can_manage_employee_methods(current_user, employee_id, session):
        raise HTTPException(status_code=403, detail="Payment method access is not permitted.")
    methods = {
        method.id: method
        for method in session.exec(
            select(EmployeePaymentMethod).where(
                EmployeePaymentMethod.company_id == _company_id(current_user),
                EmployeePaymentMethod.employee_id == employee_id,
                EmployeePaymentMethod.status != "disabled",
            )
        ).all()
    }
    allocations = {UUID(str(item["method_id"])): float(item["percentage"]) for item in data.allocations}
    if set(allocations) != set(methods):
        raise HTTPException(status_code=422, detail="Allocations must include every active payment method exactly once.")
    if round(sum(allocations.values()), 2) != 100.0:
        raise HTTPException(status_code=422, detail="Payment allocations must total exactly 100%.")
    for method_id, percentage in allocations.items():
        methods[method_id].payout_percentage = percentage
        methods[method_id].updated_at = datetime.utcnow()
    session.commit()
    return _readiness(session, employee_id, _company_id(current_user))


@router.get("/payment-accounts/payroll-readiness/{employee_id}", response_model=dict)
def payroll_readiness(
    employee_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not _can_manage_employee_methods(current_user, employee_id, session):
        raise HTTPException(status_code=403, detail="Payment method access is not permitted.")
    return _readiness(session, employee_id, _company_id(current_user))


@router.get("/payment-accounts/company", response_model=list[CompanyPaymentAccountRead])
def list_company_accounts(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not _can_manage_company_accounts(current_user, session):
        raise HTTPException(status_code=403, detail="Company payment-account access is not permitted.")
    return session.exec(
        select(CompanyPaymentAccount).where(
            CompanyPaymentAccount.company_id == _company_id(current_user)
        ).order_by(CompanyPaymentAccount.created_at)
    ).all()


@router.post("/payment-accounts/company", response_model=CompanyPaymentAccountRead)
def create_company_account(
    data: CompanyPaymentAccountCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not _can_manage_company_accounts(current_user, session):
        raise HTTPException(status_code=403, detail="Company payment-account access is not permitted.")
    _validate_details(data.account_type, data.details)
    account = CompanyPaymentAccount(
        company_id=_company_id(current_user),
        account_type=data.account_type,
        purpose=data.purpose,
        label=data.label.strip(),
        provider_name=data.provider_name,
        account_holder_name=data.account_holder_name,
        country_code=data.country_code,
        currency=data.currency.upper(),
        encrypted_details=encrypt_details(data.details),
        last4=masked_last4(data.details),
        status=data.status,
        is_default=data.is_default,
    )
    session.add(account)
    session.commit()
    session.refresh(account)
    if account.is_default:
        for other in session.exec(select(CompanyPaymentAccount).where(
            CompanyPaymentAccount.company_id == account.company_id
        )).all():
            other.is_default = other.id == account.id
        session.commit()
    return account


@router.put("/payment-accounts/company/{account_id}", response_model=CompanyPaymentAccountRead)
def update_company_account(
    account_id: UUID,
    data: CompanyPaymentAccountUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    account = session.get(CompanyPaymentAccount, account_id)
    if not account or account.company_id != _company_id(current_user):
        raise HTTPException(status_code=404, detail="Company payment account not found.")
    if not _can_manage_company_accounts(current_user, session):
        raise HTTPException(status_code=403, detail="Company payment-account access is not permitted.")
    values = data.model_dump(exclude_unset=True)
    details = values.pop("details", None)
    if details is not None:
        _validate_details(account.account_type, details)
        account.encrypted_details = encrypt_details(details)
        account.last4 = masked_last4(details)
    for key, value in values.items():
        setattr(account, key, value.upper() if key == "currency" and value else value)
    if account.status == "disabled":
        account.disabled_at = datetime.utcnow()
    if account.is_default:
        for other in session.exec(select(CompanyPaymentAccount).where(
            CompanyPaymentAccount.company_id == account.company_id
        )).all():
            other.is_default = other.id == account.id
    account.updated_at = datetime.utcnow()
    session.add(account)
    session.commit()
    session.refresh(account)
    return account
