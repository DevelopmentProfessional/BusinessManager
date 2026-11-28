"""Employee- and company-scoped persistent draft carts for Sales POS."""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

try:
    from backend.database import get_session
    from backend.models import EmployeeSalesCartItem, EmployeeSalesCartItemRead, EmployeeSalesCartItemUpsert, User
    from backend.routers.auth import get_current_user, require_page_permission
except ModuleNotFoundError:
    from database import get_session  # type: ignore
    from models import EmployeeSalesCartItem, EmployeeSalesCartItemRead, EmployeeSalesCartItemUpsert, User  # type: ignore
    from routers.auth import get_current_user, require_page_permission  # type: ignore

router = APIRouter()


def _scope_filters(current_user: User):
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="User is not associated with a company")
    return (
        EmployeeSalesCartItem.company_id == current_user.company_id,
        EmployeeSalesCartItem.employee_id == current_user.id,
    )


@router.get("/employee-sales-cart", response_model=list[EmployeeSalesCartItemRead])
def get_employee_sales_cart(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    require_page_permission(current_user, session, "sales", "read")
    return session.exec(select(EmployeeSalesCartItem).where(*_scope_filters(current_user))).all()


@router.put("/employee-sales-cart/item", response_model=EmployeeSalesCartItemRead)
def upsert_employee_sales_cart_item(
    data: EmployeeSalesCartItemUpsert,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    require_page_permission(current_user, session, "sales", "write")
    company_id, employee_id = current_user.company_id, current_user.id
    if not company_id:
        raise HTTPException(status_code=400, detail="User is not associated with a company")

    existing = session.exec(
        select(EmployeeSalesCartItem).where(
            EmployeeSalesCartItem.company_id == company_id,
            EmployeeSalesCartItem.employee_id == employee_id,
            EmployeeSalesCartItem.cart_key == data.cart_key,
        )
    ).first()

    if existing:
        for field, value in data.model_dump().items():
            setattr(existing, field, value)
        session.add(existing)
        item = existing
    else:
        item = EmployeeSalesCartItem(
            company_id=company_id,
            employee_id=employee_id,
            **data.model_dump(),
        )
        session.add(item)

    try:
        session.commit()
        session.refresh(item)
    except Exception:
        session.rollback()
        raise
    return item


@router.delete("/employee-sales-cart/item/{cart_key:path}")
def remove_employee_sales_cart_item(
    cart_key: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    require_page_permission(current_user, session, "sales", "write")
    item = session.exec(
        select(EmployeeSalesCartItem).where(
            *_scope_filters(current_user),
            EmployeeSalesCartItem.cart_key == cart_key,
        )
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    session.delete(item)
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise
    return {"ok": True}


@router.delete("/employee-sales-cart")
def clear_employee_sales_cart(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    require_page_permission(current_user, session, "sales", "write")
    items = session.exec(select(EmployeeSalesCartItem).where(*_scope_filters(current_user))).all()
    for item in items:
        session.delete(item)
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise
    return {"ok": True, "deleted": len(items)}
