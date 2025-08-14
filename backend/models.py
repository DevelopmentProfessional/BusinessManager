from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
from uuid import UUID, uuid4
from enum import Enum

class EntityType(str, Enum):
    CLIENT = "client"
    PRODUCT = "product"
    EMPLOYEE = "employee"
    ASSET = "asset"

class AttendanceStatus(str, Enum):
    CLOCK_IN = "clock_in"
    CLOCK_OUT = "clock_out"

# Base model with common fields
class BaseModel(SQLModel):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)

# Client model
class Client(BaseModel, table=True):
    name: str = Field(index=True)
    email: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None)
    address: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None)
    
    # Relationships
    schedules: List["Schedule"] = Relationship(back_populates="client")

# Product model
class Product(BaseModel, table=True):
    name: str = Field(index=True)
    sku: str = Field(unique=True, index=True)
    price: float = Field(ge=0)
    description: Optional[str] = Field(default=None)
    
    # Relationships
    inventory: Optional["Inventory"] = Relationship(back_populates="product")

# Inventory model
class Inventory(BaseModel, table=True):
    product_id: UUID = Field(foreign_key="product.id")
    supplier_id: Optional[UUID] = Field(foreign_key="supplier.id", default=None)
    quantity: int = Field(ge=0)
    min_stock_level: int = Field(ge=0, default=10)
    location: Optional[str] = Field(default=None)
    
    # Relationships
    product: Product = Relationship(back_populates="inventory")
    supplier: Optional["Supplier"] = Relationship(back_populates="inventory_items")

# Supplier model
class Supplier(BaseModel, table=True):
    name: str = Field(index=True)
    contact_person: Optional[str] = Field(default=None)
    email: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None)
    address: Optional[str] = Field(default=None)
    
    # Relationships
    inventory_items: List[Inventory] = Relationship(back_populates="supplier")

# Service model
class Service(BaseModel, table=True):
    name: str = Field(index=True)
    description: Optional[str] = Field(default=None)
    price: float = Field(ge=0)
    duration_minutes: int = Field(ge=0, default=60)
    
    # Relationships
    schedules: List["Schedule"] = Relationship(back_populates="service")

# Employee model
class Employee(BaseModel, table=True):
    first_name: str
    last_name: str
    email: str = Field(unique=True, index=True)
    phone: Optional[str] = Field(default=None)
    role: str
    hire_date: datetime
    is_active: bool = Field(default=True)
    
    # Relationships
    schedules: List["Schedule"] = Relationship(back_populates="employee")
    attendance_records: List["Attendance"] = Relationship(back_populates="employee")
    assigned_assets: List["Asset"] = Relationship(back_populates="assigned_employee")

# Schedule model
class Schedule(BaseModel, table=True):
    client_id: UUID = Field(foreign_key="client.id")
    service_id: UUID = Field(foreign_key="service.id")
    employee_id: UUID = Field(foreign_key="employee.id")
    appointment_date: datetime
    status: str = Field(default="scheduled")  # scheduled, completed, cancelled
    notes: Optional[str] = Field(default=None)
    
    # Relationships
    client: Client = Relationship(back_populates="schedules")
    service: Service = Relationship(back_populates="schedules")
    employee: Employee = Relationship(back_populates="schedules")

# Asset model
class Asset(BaseModel, table=True):
    name: str = Field(index=True)
    asset_type: str
    serial_number: Optional[str] = Field(default=None)
    purchase_date: Optional[datetime] = Field(default=None)
    purchase_price: Optional[float] = Field(ge=0, default=None)
    assigned_employee_id: Optional[UUID] = Field(foreign_key="employee.id", default=None)
    status: str = Field(default="active")  # active, maintenance, retired
    
    # Relationships
    assigned_employee: Optional[Employee] = Relationship(back_populates="assigned_assets")

# Attendance model
class Attendance(BaseModel, table=True):
    employee_id: UUID = Field(foreign_key="employee.id")
    date: datetime = Field(index=True)
    clock_in: Optional[datetime] = Field(default=None)
    clock_out: Optional[datetime] = Field(default=None)
    total_hours: Optional[float] = Field(ge=0, default=None)
    notes: Optional[str] = Field(default=None)
    
    # Relationships
    employee: Employee = Relationship(back_populates="attendance_records")

# Document model
class Document(BaseModel, table=True):
    filename: str
    original_filename: str
    file_path: str
    file_size: int = Field(ge=0)
    content_type: str
    entity_type: EntityType
    entity_id: UUID
    description: Optional[str] = Field(default=None)

# Request/Response models for API
class ClientCreate(SQLModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

class ClientUpdate(SQLModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

class ProductCreate(SQLModel):
    name: str
    sku: str
    price: float
    description: Optional[str] = None

class ServiceCreate(SQLModel):
    name: str
    description: Optional[str] = None
    price: float
    duration_minutes: int = 60

class EmployeeCreate(SQLModel):
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    role: str
    hire_date: datetime

class ScheduleCreate(SQLModel):
    client_id: UUID
    service_id: UUID
    employee_id: UUID
    appointment_date: datetime
    notes: Optional[str] = None

class AttendanceCreate(SQLModel):
    employee_id: UUID
    date: datetime
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
