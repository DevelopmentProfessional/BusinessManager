"""
WHATSAPP BUSINESS API INTEGRATION
==================================
Import products from WhatsApp Business catalog into inventory.

Flow:
1. User authenticates with WhatsApp Business API
2. Fetch products from their catalog
3. Check for missing descriptive features (sizes, colors, etc.)
4. User adds missing features via UI
5. Bulk import with deduplication by product name
"""

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlmodel import Session, select, func
from pydantic import BaseModel
from typing import Optional, List
import requests
import json
from datetime import datetime
from uuid import uuid4

from database import get_session
from models import (
    Inventory, InventoryImage, DescriptiveFeature, FeatureOption,
    InventoryFeature, InventoryFeatureOptionData
)

router = APIRouter(prefix="/inventory", tags=["inventory"])

# ─── WHATSAPP MODELS ───────────────────────────────────────────────────────────

class WhatsAppAuthRequest(BaseModel):
    access_token: str
    business_account_id: str


class WhatsAppProduct(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    image_url: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    # Custom field: variants as dict {feature_name: [option_names]}
    variants: Optional[dict] = None  # e.g. {"Size": ["S", "M", "L"], "Color": ["Red", "Blue"]}


class WhatsAppImportRequest(BaseModel):
    """User submits after validating features"""
    products: List[WhatsAppProduct]
    company_id: str


class MissingFeature(BaseModel):
    feature_name: str
    options_to_add: List[str]


class FeatureValidationResponse(BaseModel):
    missing_features: List[MissingFeature]
    can_proceed: bool


# ─── HELPERS ───────────────────────────────────────────────────────────────────

def fetch_whatsapp_catalog(access_token: str, business_account_id: str) -> List[WhatsAppProduct]:
    """
    Fetch products from WhatsApp Business catalog.
    Requires valid access token and business account ID.
    """
    try:
        url = f"https://graph.instagram.com/v18.0/{business_account_id}/catalog"
        headers = {"Authorization": f"Bearer {access_token}"}
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        products = []
        
        # Parse WhatsApp catalog response
        for item in data.get("data", []):
            product = WhatsAppProduct(
                id=item.get("id"),
                name=item.get("name"),
                description=item.get("description"),
                price=item.get("price"),
                currency=item.get("currency"),
                image_url=item.get("image_url"),
                sku=item.get("sku"),
                category=item.get("category"),
                variants=item.get("variants", {})
            )
            products.append(product)
        
        return products
    except requests.RequestException as e:
        raise HTTPException(status_code=400, detail=f"WhatsApp API error: {str(e)}")


def validate_features(products: List[WhatsAppProduct], session: Session, company_id: str) -> FeatureValidationResponse:
    """
    Check if all descriptive features used by products exist.
    Return missing features that user must add before import.
    """
    all_feature_options = {}  # {feature_name: set(option_names)}
    
    # Collect all features and options from products
    for product in products:
        if product.variants:
            for feature_name, option_names in product.variants.items():
                if feature_name not in all_feature_options:
                    all_feature_options[feature_name] = set()
                all_feature_options[feature_name].update(option_names)
    
    missing = []
    
    # Check each feature exists and has all options
    for feature_name, option_names in all_feature_options.items():
        feature = session.exec(
            select(DescriptiveFeature)
            .where(DescriptiveFeature.name == feature_name)
            .where(DescriptiveFeature.company_id == company_id)
        ).first()
        
        if not feature:
            # Feature doesn't exist
            missing.append(MissingFeature(
                feature_name=feature_name,
                options_to_add=list(option_names)
            ))
        else:
            # Feature exists, check options
            existing_options = session.exec(
                select(FeatureOption.name)
                .where(FeatureOption.feature_id == feature.id)
            ).all()
            existing_set = set(existing_options)
            missing_options = option_names - existing_set
            
            if missing_options:
                missing.append(MissingFeature(
                    feature_name=feature_name,
                    options_to_add=list(missing_options)
                ))
    
    return FeatureValidationResponse(
        missing_features=missing,
        can_proceed=len(missing) == 0
    )


def dedup_by_name(products: List[WhatsAppProduct], existing_names: set) -> List[WhatsAppProduct]:
    """Filter products, skip any with duplicate names in existing inventory."""
    return [p for p in products if p.name not in existing_names]


# ─── ENDPOINTS ─────────────────────────────────────────────────────────────────

@router.post("/whatsapp/fetch")
def fetch_whatsapp_products(
    req: WhatsAppAuthRequest,
    session: Session = Depends(get_session)
):
    """Fetch products from user's WhatsApp Business catalog."""
    try:
        products = fetch_whatsapp_catalog(req.access_token, req.business_account_id)
        return {"ok": True, "products": products, "count": len(products)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/whatsapp/validate-features")
def validate_import_features(
    req: WhatsAppImportRequest,
    session: Session = Depends(get_session)
):
    """Check if all product features exist in system."""
    validation = validate_features(req.products, session, req.company_id)
    return validation.model_dump()


@router.post("/whatsapp/import")
def import_whatsapp_products(
    req: WhatsAppImportRequest,
    session: Session = Depends(get_session)
):
    """
    Bulk import WhatsApp products with deduplication.
    Assumes user has already validated and created missing features.
    """
    company_id = req.company_id
    
    # Get existing product names to avoid duplicates
    existing_names = set(session.exec(
        select(Inventory.name)
        .where(Inventory.company_id == company_id)
        .where(Inventory.type == "product")
    ).all())
    
    # Deduplicate
    products_to_import = dedup_by_name(req.products, existing_names)
    
    imported_count = 0
    skipped_count = len(req.products) - len(products_to_import)
    
    try:
        for product in products_to_import:
            # Create inventory item
            inventory = Inventory(
                name=product.name,
                sku=product.sku,
                price=product.price or 0.0,
                description=product.description,
                category=product.category or "General",
                type="product",
                company_id=company_id
            )
            session.add(inventory)
            session.flush()  # Get the ID
            
            # Add image if available
            if product.image_url:
                img = InventoryImage(
                    inventory_id=inventory.id,
                    image_url=product.image_url,
                    file_name=f"{product.name}_from_whatsapp",
                    mime_type="image/jpeg",
                    is_primary=True,
                    company_id=company_id
                )
                session.add(img)
            
            # Attach features/options
            if product.variants:
                for feature_name, option_names in product.variants.items():
                    # Get or create feature
                    feature = session.exec(
                        select(DescriptiveFeature)
                        .where(DescriptiveFeature.name == feature_name)
                        .where(DescriptiveFeature.company_id == company_id)
                    ).first()
                    
                    if not feature:
                        feature = DescriptiveFeature(name=feature_name, company_id=company_id)
                        session.add(feature)
                        session.flush()
                    
                    # Link feature to inventory
                    inv_feature = InventoryFeature(
                        inventory_id=inventory.id,
                        feature_id=feature.id,
                        company_id=company_id
                    )
                    session.add(inv_feature)
                    session.flush()
                    
                    # Add feature options
                    for option_name in option_names:
                        option = session.exec(
                            select(FeatureOption)
                            .where(FeatureOption.feature_id == feature.id)
                            .where(FeatureOption.name == option_name)
                        ).first()
                        
                        if not option:
                            option = FeatureOption(feature_id=feature.id, name=option_name, company_id=company_id)
                            session.add(option)
                            session.flush()
                        
                        # Link option to inventory
                        option_data = InventoryFeatureOptionData(
                            inventory_feature_id=inv_feature.id,
                            feature_option_id=option.id,
                            company_id=company_id
                        )
                        session.add(option_data)
            
            imported_count += 1
        
        session.commit()
        
        return {
            "ok": True,
            "imported": imported_count,
            "skipped": skipped_count,
            "message": f"Imported {imported_count} products. Skipped {skipped_count} duplicates."
        }
    
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.post("/whatsapp/add-missing-features")
def add_missing_features(
    feature_name: str,
    options: List[str],
    company_id: str,
    session: Session = Depends(get_session)
):
    """
    Create a descriptive feature and its options before import.
    Called from wizard when user confirms adding missing features.
    """
    try:
        # Create feature
        feature = DescriptiveFeature(name=feature_name, company_id=company_id)
        session.add(feature)
        session.flush()
        
        # Create options
        for option_name in options:
            option = FeatureOption(feature_id=feature.id, name=option_name, company_id=company_id)
            session.add(option)
        
        session.commit()
        
        return {
            "ok": True,
            "feature_id": str(feature.id),
            "feature_name": feature_name,
            "options_added": len(options)
        }
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
