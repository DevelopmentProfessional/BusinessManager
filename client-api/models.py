"""
CLIENT-API MODELS
=================
Defines ONLY the SQLModel table classes needed by the client-facing API.
Every __tablename__ maps to the EXACT same table as in the internal API
so both services share one PostgreSQL database safely.

New tables added here (client_booking, client_order, client_order_item)
follow the same naming and field conventions as the internal API.

READ-ONLY mirrors  — Client, Schedule, Service, Inventory, AppSettings,
                     ServiceEmployee, ServiceAsset, AssetUnit
EXTENDED           — Client (new auth columns added via migration)
NEW                — ClientBooking, ClientOrder, ClientOrderItem
"""

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, LargeBinary
from typing import Optional, List
from datetime import datetime
from uuid import UUID, uuid4
from enum import Enum


# ─── BASE ──────────────────────────────────────────────────────────────────────

class BaseModel(SQLModel):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ─── ENUMS ─────────────────────────────────────────────────────────────────────

class MembershipTier(str, Enum):
    NONE = "none"
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    PLATINUM = "platinum"


class BookingMode(str, Enum):
    SOFT = "soft"        # No upfront payment; subject to cancellation fee
    LOCKED = "locked"    # Paid upfront; guaranteed slot


class BookingStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    NO_SHOW = "no_show"


class OrderStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


# ─── EXISTING TABLES (read-only mirrors) ───────────────────────────────────────

class Company(BaseModel, table=True):
    """Registry of all companies. Authoritative source for company selection screen."""
    __tablename__ = "company"
    company_id: str = Field(unique=True, index=True)
    name: str = Field(index=True)
    is_active: bool = Field(default=True)


class Client(BaseModel, table=True):
    """
    Maps to the existing 'client' table.
    Auth columns (password_hash, email_verified, last_login, reset_token,
    reset_token_expires) are added by migration.
    """
    __tablename__ = "client"

    name: str = Field(index=True)
    email: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None)
    address: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None)

    membership_tier: str = Field(default="none")
    membership_since: Optional[datetime] = Field(default=None)
    membership_expires: Optional[datetime] = Field(default=None)
    membership_points: int = Field(default=0)

    # Auth columns (added by migration)
    password_hash: Optional[str] = Field(default=None)
    email_verified: bool = Field(default=False)
    last_login: Optional[datetime] = Field(default=None)
    reset_token: Optional[str] = Field(default=None)
    reset_token_expires: Optional[datetime] = Field(default=None)

    company_id: Optional[str] = Field(default=None, index=True)


class AppSettings(BaseModel, table=True):
    """Mirrors app_settings — reads scheduling policy for bookings."""
    __tablename__ = "app_settings"

    start_of_day: str = Field(default="06:00")
    end_of_day: str = Field(default="21:00")
    monday_enabled: bool = Field(default=True)
    tuesday_enabled: bool = Field(default=True)
    wednesday_enabled: bool = Field(default=True)
    thursday_enabled: bool = Field(default=True)
    friday_enabled: bool = Field(default=True)
    saturday_enabled: bool = Field(default=True)
    sunday_enabled: bool = Field(default=True)
    tax_rate: Optional[float] = Field(default=0.0)
    company_name: Optional[str] = Field(default=None)
    company_email: Optional[str] = Field(default=None)
    company_phone: Optional[str] = Field(default=None)
    company_address: Optional[str] = Field(default=None)

    # Cancellation/refund policy (added by migration)
    cancellation_percentage: float = Field(default=10.0)
    refund_percentage: float = Field(default=80.0)

    # Company logo (added by migration)
    logo_url: Optional[str] = Field(default=None)
    logo_data: Optional[bytes] = Field(default=None, sa_column=Column(LargeBinary, nullable=True))

    company_id: Optional[str] = Field(default=None, index=True)


class Service(BaseModel, table=True):
    __tablename__ = "service"
    name: str = Field(index=True)
    description: Optional[str] = Field(default=None)
    category: Optional[str] = Field(default=None)
    price: float = Field(ge=0)
    duration_minutes: int = Field(ge=0, default=60)
    image_url: Optional[str] = Field(default=None)
    company_id: Optional[str] = Field(default=None, index=True)


class Inventory(BaseModel, table=True):
    __tablename__ = "inventory"
    name: str = Field(index=True)
    sku: Optional[str] = Field(default=None, index=True)
    price: float = Field(ge=0, default=0)
    description: Optional[str] = Field(default=None)
    category: Optional[str] = Field(default=None)
    type: str = Field(default="product")
    image_url: Optional[str] = Field(default=None)
    quantity: int = Field(ge=0, default=0)
    supplier_id: Optional[UUID] = Field(default=None)
    location: Optional[str] = Field(default=None)
    price_type: Optional[str] = Field(default="fixed")
    price_percentage: Optional[float] = Field(default=None)
    cost: Optional[float] = Field(default=None)
    company_id: Optional[str] = Field(default=None, index=True)


class InventoryImage(BaseModel, table=True):
    __tablename__ = "inventoryimage"
    inventory_id: UUID = Field(foreign_key="inventory.id", index=True)
    image_url: Optional[str] = Field(default=None)
    file_path: Optional[str] = Field(default=None)
    file_name: Optional[str] = Field(default=None)
    mime_type: Optional[str] = Field(default=None)
    image_data: Optional[bytes] = Field(default=None, sa_column=Column(LargeBinary, nullable=True))
    is_primary: bool = Field(default=False)
    sort_order: int = Field(default=0)
    company_id: Optional[str] = Field(default=None, index=True)


class Schedule(BaseModel, table=True):
    __tablename__ = "schedule"
    client_id: Optional[UUID] = Field(default=None)
    service_id: Optional[UUID] = Field(default=None)
    employee_id: UUID = Field(foreign_key="user.id")
    appointment_date: datetime
    status: str = Field(default="scheduled")
    notes: Optional[str] = Field(default=None)
    duration_minutes: int = Field(default=60)
    is_paid: bool = Field(default=False)
    discount: float = Field(default=0.0)
    task_type: str = Field(default="service")
    company_id: Optional[str] = Field(default=None, index=True)


class ServiceEmployee(BaseModel, table=True):
    """Employees capable of performing a service."""
    __tablename__ = "service_employee"
    service_id: UUID = Field(foreign_key="service.id", index=True)
    user_id: UUID = Field(foreign_key="user.id", index=True)
    notes: Optional[str] = Field(default=None)
    company_id: Optional[str] = Field(default=None, index=True)


class ServiceAsset(BaseModel, table=True):
    """Assets (equipment) reserved for a service."""
    __tablename__ = "service_asset"
    service_id: UUID = Field(foreign_key="service.id", index=True)
    inventory_id: UUID = Field(foreign_key="inventory.id", index=True)
    asset_duration_minutes: Optional[float] = Field(default=None)
    notes: Optional[str] = Field(default=None)
    company_id: Optional[str] = Field(default=None, index=True)


class AssetUnit(BaseModel, table=True):
    """Individual physical unit of an asset inventory item."""
    __tablename__ = "asset_unit"
    inventory_id: UUID = Field(foreign_key="inventory.id", index=True)
    label: Optional[str] = Field(default=None)
    state: str = Field(default="available", index=True)
    schedule_id: Optional[UUID] = Field(default=None)
    notes: Optional[str] = Field(default=None)
    company_id: Optional[str] = Field(default=None, index=True)


# ─── SHARED CART TABLE (read/write from client portal) ─────────────────────────

class ClientCartItem(BaseModel, table=True):
    """Persistent cart items — same table used by internal app's client_cart router."""
    __tablename__ = "client_cart_item"
    client_id: UUID = Field(index=True)
    cart_key: str = Field(index=True)   # "{item_type}-{item_id}"
    item_id: Optional[UUID] = Field(default=None)
    item_type: str                       # "product" or "service"
    item_name: str
    unit_price: float = Field(default=0)
    quantity: int = Field(default=1)
    line_total: float = Field(default=0)
    options_json: Optional[str] = Field(default=None)
    company_id: Optional[str] = Field(default=None, index=True)


class ClientCartItemRead(SQLModel):
    id: UUID
    client_id: UUID
    cart_key: str
    item_id: Optional[UUID] = None
    item_type: str
    item_name: str
    unit_price: float
    quantity: int
    line_total: float
    options_json: Optional[str] = None

    model_config = {"from_attributes": True}


class ClientCartItemUpsert(SQLModel):
    cart_key: str
    item_id: Optional[UUID] = None
    item_type: str
    item_name: str
    unit_price: float = 0
    quantity: int = 1
    line_total: float = 0
    options_json: Optional[str] = None


# ─── NEW CLIENT-PORTAL TABLES ──────────────────────────────────────────────────

class ClientBooking(BaseModel, table=True):
    """
    Represents a client-initiated booking (from the client portal).
    Links to the internal Schedule table after staff confirmation.

    booking_mode:
      'soft'   — No payment made. Cancellation fee applies if cancelled.
      'locked' — Payment made upfront. Refund policy applies if cancelled.
    """
    __tablename__ = "client_booking"

    client_id: UUID = Field(foreign_key="client.id", index=True)
    service_id: UUID = Field(foreign_key="service.id", index=True)
    schedule_id: Optional[UUID] = Field(default=None)   # Set after staff confirms

    booking_mode: str = Field(default="soft")           # soft | locked
    status: str = Field(default="pending")              # pending | confirmed | cancelled | completed | no_show

    appointment_date: datetime
    duration_minutes: int = Field(default=60)
    notes: Optional[str] = Field(default=None)

    # Payment tracking
    stripe_payment_intent_id: Optional[str] = Field(default=None)
    amount_paid: float = Field(default=0.0)
    cancellation_charge: float = Field(default=0.0)     # Charged if cancelled (soft mode)
    refund_amount: float = Field(default=0.0)           # Refunded if cancelled (locked mode)

    company_id: Optional[str] = Field(default=None, index=True)


class ClientOrder(BaseModel, table=True):
    """
    An order placed through the client portal (products + services).
    Linked to a Stripe PaymentIntent for actual payment processing.
    """
    __tablename__ = "client_order"

    client_id: UUID = Field(foreign_key="client.id", index=True)
    status: str = Field(default="pending")              # pending | paid | cancelled | refunded

    subtotal: float = Field(default=0.0)
    tax_amount: float = Field(default=0.0)
    total: float = Field(default=0.0)
    payment_method: Optional[str] = Field(default=None)
    stripe_payment_intent_id: Optional[str] = Field(default=None)
    stripe_charge_id: Optional[str] = Field(default=None)

    company_id: Optional[str] = Field(default=None, index=True)


class ClientOrderItem(BaseModel, table=True):
    """Line items within a ClientOrder (products or bookings)."""
    __tablename__ = "client_order_item"

    order_id: UUID = Field(foreign_key="client_order.id", index=True)
    item_id: Optional[UUID] = Field(default=None)       # Inventory or Service ID
    item_type: str = Field(default="product")           # product | service
    item_name: str
    unit_price: float = Field(default=0.0)
    quantity: int = Field(default=1)
    line_total: float = Field(default=0.0)
    booking_id: Optional[UUID] = Field(default=None, foreign_key="client_booking.id")

    company_id: Optional[str] = Field(default=None, index=True)


# ─── PYDANTIC SCHEMAS ──────────────────────────────────────────────────────────

class ClientRegister(SQLModel):
    name: str
    email: str
    password: str
    phone: Optional[str] = None
    address: Optional[str] = None
    company_id: str


class ClientLogin(SQLModel):
    email: str
    password: str
    company_id: str


class ClientTokenResponse(SQLModel):
    access_token: str
    token_type: str = "bearer"
    client_id: str
    name: str
    email: str
    membership_tier: str


class ClientPublicRead(SQLModel):
    id: UUID
    name: str
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    membership_tier: str
    membership_points: int
    membership_since: Optional[datetime]
    membership_expires: Optional[datetime]
    company_id: Optional[str]
    created_at: datetime


class ClientUpdate(SQLModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class CatalogProductRead(SQLModel):
    id: UUID
    name: str
    description: Optional[str]
    category: Optional[str]
    price: float
    type: str
    quantity: int
    image_url: Optional[str]
    company_id: Optional[str]


class CatalogServiceRead(SQLModel):
    id: UUID
    name: str
    description: Optional[str]
    category: Optional[str]
    price: float
    duration_minutes: int
    image_url: Optional[str]
    company_id: Optional[str]


class AvailabilitySlot(SQLModel):
    start: datetime
    end: datetime
    employee_id: str
    employee_name: str
    available: bool


class BookingCreate(SQLModel):
    service_id: str
    appointment_date: datetime
    booking_mode: str = "soft"   # soft | locked
    notes: Optional[str] = None


class BookingRead(SQLModel):
    id: UUID
    client_id: UUID
    service_id: UUID
    booking_mode: str
    status: str
    appointment_date: datetime
    duration_minutes: int
    notes: Optional[str]
    amount_paid: float
    cancellation_charge: float
    refund_amount: float
    created_at: datetime


class OrderItemInput(SQLModel):
    item_id: str
    item_type: str   # product | service
    item_name: str
    unit_price: float
    quantity: int
    booking_id: Optional[str] = None


class OrderCreate(SQLModel):
    items: List[OrderItemInput]
    payment_method: Optional[str] = None


class OrderRead(SQLModel):
    id: UUID
    client_id: UUID
    status: str
    subtotal: float
    tax_amount: float
    total: float
    payment_method: Optional[str]
    stripe_payment_intent_id: Optional[str]
    created_at: datetime


class OrderItemRead(SQLModel):
    id: UUID
    order_id: UUID
    item_id: Optional[UUID]
    item_type: str
    item_name: str
    unit_price: float
    quantity: int
    line_total: float
    booking_id: Optional[UUID]
