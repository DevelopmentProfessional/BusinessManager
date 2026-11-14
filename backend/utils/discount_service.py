# ============================================================
# FILE: discount_service.py
#
# PURPOSE:
#   Provides discount calculation utilities for items, cart items,
#   and orders. Applies discount rules based on item IDs and discount type.
#
# FUNCTIONS:
#   apply_discount_to_price()      - Apply discount to single price
#   apply_discount_to_item()       - Apply discount to item data
#   apply_discount_to_cart_item()  - Apply discount to cart item
#   get_applicable_discounts()     - Get all applicable discounts for items
#
# CHANGE LOG:
#   2026-05-21 | Claude | Initial creation for discount application service
# ============================================================

from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlmodel import Session, select
import json

try:
    from backend.models import DiscountRule
except ModuleNotFoundError:
    from models import DiscountRule  # type: ignore


def apply_discount_to_price(
    original_price: float,
    discount_type: str,
    discount_value: float,
) -> tuple[float, float]:
    """
    Apply a discount to a price.
    
    Args:
        original_price: Original price before discount
        discount_type: 'percentage' or 'fixed'
        discount_value: Discount percentage (0-100) or fixed amount
    
    Returns:
        Tuple of (discounted_price, discount_amount)
    """
    if discount_type == "percentage":
        if discount_value < 0 or discount_value > 100:
            return original_price, 0.0
        discount_amount = original_price * (discount_value / 100)
        discounted_price = original_price - discount_amount
    elif discount_type == "fixed":
        discount_amount = min(discount_value, original_price)
        discounted_price = original_price - discount_amount
    else:
        return original_price, 0.0
    
    return max(discounted_price, 0.0), discount_amount


def get_applicable_discounts(
    session: Session,
    item_ids: List[UUID],
    company_id: UUID,
) -> Dict[UUID, DiscountRule]:
    """
    Get all active discount rules applicable to given item IDs.
    
    Args:
        session: Database session
        item_ids: List of item IDs to check
        company_id: Company ID to filter by
    
    Returns:
        Dictionary mapping item_id to applicable DiscountRule (first applicable rule per item)
    """
    if not item_ids:
        return {}
    
    # Get all active discount rules for the company
    stmt = select(DiscountRule).where(
        DiscountRule.company_id == company_id,
        DiscountRule.is_active == True,
    )
    rules = session.exec(stmt).all()
    
    # Build mapping of item_id -> rule
    applicable_discounts: Dict[UUID, DiscountRule] = {}
    
    for rule in rules:
        try:
            # Parse item_ids JSON if it's a string
            if isinstance(rule.item_ids, str):
                rule_item_ids = json.loads(rule.item_ids) if rule.item_ids else []
            else:
                rule_item_ids = rule.item_ids or []
            
            # Convert to UUIDs for comparison
            rule_item_uuids = [UUID(str(id)) for id in rule_item_ids]
            
            # Apply discount to matching items (use first matching rule per item)
            for item_id in item_ids:
                if item_id not in applicable_discounts and item_id in rule_item_uuids:
                    applicable_discounts[item_id] = rule
        except (json.JSONDecodeError, ValueError, TypeError):
            # Skip malformed rules
            continue
    
    return applicable_discounts


def apply_discount_to_item(
    item_data: Dict[str, Any],
    discount: Optional[DiscountRule] = None,
) -> Dict[str, Any]:
    """
    Apply discount to item data dictionary.
    Adds: discounted_price, discount_amount, discount_type, discount_value, original_price
    
    Args:
        item_data: Item dictionary with 'price' key
        discount: DiscountRule to apply, or None
    
    Returns:
        Modified item_data dictionary with discount fields
    """
    original_price = item_data.get("price", 0.0)
    
    if discount and discount.is_active:
        discounted_price, discount_amount = apply_discount_to_price(
            float(original_price),
            discount.discount_type,
            float(discount.discount_value),
        )
        item_data["original_price"] = original_price
        item_data["discounted_price"] = discounted_price
        item_data["discount_amount"] = discount_amount
        item_data["discount_type"] = discount.discount_type
        item_data["discount_value"] = discount.discount_value
        # Use discounted price as the primary price
        item_data["price"] = discounted_price
    else:
        item_data["original_price"] = original_price
        item_data["discounted_price"] = original_price
        item_data["discount_amount"] = 0.0
        item_data["discount_type"] = None
        item_data["discount_value"] = None
    
    return item_data


def apply_discount_to_cart_item(
    cart_item_data: Dict[str, Any],
    discount: Optional[DiscountRule] = None,
) -> Dict[str, Any]:
    """
    Apply discount to cart item and calculate totals.
    Adds: unit_price_original, unit_price_discounted, line_discount, line_total_before_discount, line_total
    
    Args:
        cart_item_data: Cart item dictionary with 'unit_price' and 'quantity' keys
        discount: DiscountRule to apply, or None
    
    Returns:
        Modified cart_item_data dictionary with discount and total fields
    """
    unit_price = cart_item_data.get("unit_price", 0.0)
    quantity = cart_item_data.get("quantity", 0)
    
    if discount and discount.is_active:
        discounted_unit_price, unit_discount = apply_discount_to_price(
            float(unit_price),
            discount.discount_type,
            float(discount.discount_value),
        )
        cart_item_data["unit_price_original"] = unit_price
        cart_item_data["unit_price_discounted"] = discounted_unit_price
        cart_item_data["unit_discount_amount"] = unit_discount
        cart_item_data["discount_type"] = discount.discount_type
        cart_item_data["discount_value"] = discount.discount_value
        
        # Calculate line totals
        line_total_before_discount = float(unit_price) * quantity
        line_total_discount = unit_discount * quantity
        line_total = discounted_unit_price * quantity
        
        cart_item_data["line_total_before_discount"] = line_total_before_discount
        cart_item_data["line_discount_amount"] = line_total_discount
        cart_item_data["line_total"] = line_total
    else:
        cart_item_data["unit_price_original"] = unit_price
        cart_item_data["unit_price_discounted"] = unit_price
        cart_item_data["unit_discount_amount"] = 0.0
        cart_item_data["discount_type"] = None
        cart_item_data["discount_value"] = None
        
        line_total = float(unit_price) * quantity
        cart_item_data["line_total_before_discount"] = line_total
        cart_item_data["line_discount_amount"] = 0.0
        cart_item_data["line_total"] = line_total
    
    return cart_item_data


def calculate_order_totals_with_discounts(
    session: Session,
    line_items: List[Dict[str, Any]],
    company_id: UUID,
    tax_rate: float = 0.0,
) -> Dict[str, float]:
    """
    Calculate order subtotal, tax, and total with discounts applied.
    
    Args:
        session: Database session
        line_items: List of line items with 'item_id', 'quantity', 'unit_price'
        company_id: Company ID to filter discounts by
        tax_rate: Tax rate as decimal (e.g., 0.1 for 10%)
    
    Returns:
        Dictionary with: subtotal, total_discount, subtotal_after_discount, tax_amount, total
    """
    # Extract item IDs
    item_ids = [item["item_id"] for item in line_items if "item_id" in item]
    
    # Get applicable discounts
    discounts = get_applicable_discounts(session, item_ids, company_id)
    
    # Calculate subtotal and total discount
    subtotal = 0.0
    total_discount = 0.0
    
    for item in line_items:
        unit_price = float(item.get("unit_price", 0.0))
        quantity = int(item.get("quantity", 0))
        item_id = item.get("item_id")
        
        line_subtotal = unit_price * quantity
        subtotal += line_subtotal
        
        # Apply discount if applicable
        discount = discounts.get(item_id)
        if discount:
            _, discount_amount_per_unit = apply_discount_to_price(
                unit_price,
                discount.discount_type,
                float(discount.discount_value),
            )
            total_discount += discount_amount_per_unit * quantity
    
    subtotal_after_discount = subtotal - total_discount
    tax_amount = subtotal_after_discount * tax_rate
    total = subtotal_after_discount + tax_amount
    
    return {
        "subtotal": subtotal,
        "total_discount": total_discount,
        "subtotal_after_discount": subtotal_after_discount,
        "tax_amount": tax_amount,
        "total": total,
    }
