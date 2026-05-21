# ============================================================
# FILE: discount_rules.py
#
# PURPOSE:
#   Provides CRUD endpoints for discount rules (scheduled discounts
#   applied to inventory items).
#
# ENDPOINTS:
#   GET    /api/v1/discount-rules              — list all discount rules
#   POST   /api/v1/discount-rules              — create new discount rule
#   GET    /api/v1/discount-rules/{id}         — get discount rule by ID
#   PUT    /api/v1/discount-rules/{id}         — update discount rule
#   DELETE /api/v1/discount-rules/{id}         — delete discount rule
#
# CHANGE LOG:
#   2026-05-21 | Claude | Initial creation for discount rules management
# ============================================================

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

try:
    from backend.database import get_session
    from backend.models import DiscountRule, DiscountRuleRead, User
    from backend.routers.auth import get_current_user
except ModuleNotFoundError:
    from database import get_session
    from models import DiscountRule, DiscountRuleRead, User
    from routers.auth import get_current_user

router = APIRouter()


@router.get("/discount-rules", response_model=list[DiscountRuleRead])
def list_discount_rules(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List all discount rules for the user's company."""
    query = select(DiscountRule).where(
        DiscountRule.company_id == current_user.company_id
    )
    query = query.offset(skip).limit(limit)
    rules = session.exec(query).all()
    return rules


@router.post("/discount-rules", response_model=DiscountRuleRead, status_code=status.HTTP_201_CREATED)
def create_discount_rule(
    rule: DiscountRule,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new discount rule."""
    rule.company_id = current_user.company_id
    rule.created_by = current_user.id
    rule.created_at = datetime.utcnow()
    
    session.add(rule)
    try:
        session.commit()
        session.refresh(rule)
        return rule
    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create discount rule: {str(e)}"
        )


@router.get("/discount-rules/{rule_id}", response_model=DiscountRuleRead)
def get_discount_rule(
    rule_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get a discount rule by ID."""
    rule = session.get(DiscountRule, rule_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discount rule not found"
        )
    if rule.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this discount rule"
        )
    return rule


@router.put("/discount-rules/{rule_id}", response_model=DiscountRuleRead)
def update_discount_rule(
    rule_id: int,
    updated_rule: DiscountRule,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a discount rule."""
    rule = session.get(DiscountRule, rule_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discount rule not found"
        )
    if rule.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this discount rule"
        )
    
    # Update fields
    rule.name = updated_rule.name
    rule.description = updated_rule.description
    rule.discount_type = updated_rule.discount_type
    rule.discount_value = updated_rule.discount_value
    rule.start_date = updated_rule.start_date
    rule.end_date = updated_rule.end_date
    rule.item_ids = updated_rule.item_ids
    rule.is_active = updated_rule.is_active
    rule.updated_at = datetime.utcnow()
    
    session.add(rule)
    try:
        session.commit()
        session.refresh(rule)
        return rule
    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update discount rule: {str(e)}"
        )


@router.delete("/discount-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_discount_rule(
    rule_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete a discount rule."""
    rule = session.get(DiscountRule, rule_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discount rule not found"
        )
    if rule.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this discount rule"
        )
    
    session.delete(rule)
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to delete discount rule: {str(e)}"
        )
