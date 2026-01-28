from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List, Union
from datetime import datetime
from uuid import UUID, uuid4
from enum import Enum
import bcrypt

class EntityType(str, Enum):
    CLIENT = "client"
    ITEM = "item"
    EMPLOYEE = "employee"
    ASSET = "asset"


class ItemType(str, Enum):
    ITEM = "item"
    ASSET = "asset"


class AttendanceStatus(str, Enum):
    CLOCK_IN = "clock_in"
    CLOCK_OUT = "clock_out"

# User roles and permissions
class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    EMPLOYEE = "employee"
    VIEWER = "viewer"

class PermissionType(str, Enum):
    READ = "read"
    READ_ALL = "read_all"  # New: Read all records permission
    WRITE = "write"
    WRITE_ALL = "write_all"  # Keeping for compatibility, but schedule will use VIEW_ALL
    DELETE = "delete"
    ADMIN = "admin"
    VIEW_ALL = "view_all"  # Schedule page uses this instead of WRITE_ALL

# Base model with common fields
class BaseModel(SQLModel):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)

# User model for authentication (consolidated user/employee)
class User(BaseModel, table=True):
    username: str = Field(unique=True, index=True)
    email: Optional[str] = Field(default=None, unique=True, index=True)  # Made optional
    password_hash: str
    first_name: str
    last_name: str
    phone: Optional[str] = Field(default=None)
    role: UserRole = Field(default=UserRole.EMPLOYEE)  # Default to EMPLOYEE
    hire_date: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = Field(default=True)
    is_locked: bool = Field(default=False)
    force_password_reset: bool = Field(default=False)
    last_login: Optional[datetime] = Field(default=None)
    failed_login_attempts: int = Field(default=0)
    locked_until: Optional[datetime] = Field(default=None)
    dark_mode: bool = Field(default=False)  # User's dark mode preference
    
    # Relationships
    permissions: List["UserPermission"] = Relationship(back_populates="user")
    attendance_records: List["Attendance"] = Relationship(back_populates="user")
    schedules: List["Schedule"] = Relationship(back_populates="employee")
    
    @classmethod
    def hash_password(cls, password: str) -> str:
        """Hash a password using bcrypt"""
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    def verify_password(self, password: str) -> bool:
        """Verify a password against the stored hash"""
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))

# User Permission model for granular access control
class UserPermission(BaseModel, table=True):
    user_id: UUID = Field(foreign_key="user.id")
    page: str  # e.g., "clients", "inventory", "employees"
    permission: PermissionType
    granted: bool = Field(default=True)
    
    # Relationships
    user: User = Relationship(back_populates="permissions")

# Client model
class Client(BaseModel, table=True):
    name: str = Field(unique=True, index=True)  # Client names must be unique
    email: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None)
    address: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None)
    
    # Relationships
    schedules: List["Schedule"] = Relationship(back_populates="client")


# Item model
class Item(BaseModel, table=True):
    name: str = Field(unique=True, index=True)
    sku: str = Field(unique=True, index=True)
    price: float = Field(ge=0)
    description: Optional[str] = Field(default=None)
    inventory: Optional["Inventory"] = Relationship(back_populates="item")


# Inventory model
class Inventory(BaseModel, table=True):
    item_id: UUID = Field(foreign_key="item.id")
    supplier_id: Optional[UUID] = Field(foreign_key="supplier.id", default=None)
    quantity: int = Field(ge=0)
    min_stock_level: int = Field(ge=0, default=10)
    location: Optional[str] = Field(default=None)
    
    # Relationships
    item: Item = Relationship(back_populates="inventory")
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
    name: str = Field(unique=True, index=True)  # Service names must be unique
    description: Optional[str] = Field(default=None)
    category: Optional[str] = Field(default=None)
    price: float = Field(ge=0)
    duration_minutes: int = Field(ge=0, default=60)
    
    # Relationships
    schedules: List["Schedule"] = Relationship(back_populates="service")


# Employee model
# Employee model removed - now using User model directly

# Schedule model
class Schedule(BaseModel, table=True):
    client_id: UUID = Field(foreign_key="client.id")
    service_id: UUID = Field(foreign_key="service.id")
    employee_id: UUID = Field(foreign_key="user.id")  # Now references user directly
    appointment_date: datetime
    status: str = Field(default="scheduled")  # scheduled, completed, cancelled
    notes: Optional[str] = Field(default=None)
    
    # Relationships
    client: Client = Relationship(back_populates="schedules")
    service: Service = Relationship(back_populates="schedules")
    employee: "User" = Relationship(back_populates="schedules")


# Asset model
## Asset model removed

# Attendance model
class Attendance(BaseModel, table=True):
    user_id: UUID = Field(foreign_key="user.id")  # Now references user directly
    date: datetime = Field(index=True)
    clock_in: Optional[datetime] = Field(default=None)
    clock_out: Optional[datetime] = Field(default=None)
    total_hours: Optional[float] = Field(ge=0, default=None)
    notes: Optional[str] = Field(default=None)
    
    # Relationships
    user: User = Relationship(back_populates="attendance_records")


# Document model
class Document(BaseModel, table=True):
    filename: str
    original_filename: str
    file_path: str
    file_size: int = Field(ge=0)
    content_type: str
    entity_type: Optional[EntityType] = Field(default=None)
    entity_id: Optional[UUID] = Field(default=None)
    description: Optional[str] = Field(default=None)
    # e-sign fields
    is_signed: bool = Field(default=False)
    signed_by: Optional[str] = Field(default=None)
    signed_at: Optional[datetime] = Field(default=None)
    # ownership / review / category
    owner_id: Optional[UUID] = Field(foreign_key="user.id", default=None)
    review_date: Optional[datetime] = Field(default=None)
    category_id: Optional[UUID] = Field(foreign_key="document_category.id", default=None)


class DocumentCategory(BaseModel, table=True):
    __tablename__ = "document_category"
    name: str = Field(index=True)
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

class ItemCreate(SQLModel):
    name: str
    sku: str
    price: float
    description: Optional[str] = None
    # Accept either enum value/name as string or ItemType; router will normalize
    type: Optional[Union[ItemType, str]] = "item"



class UserCreate(SQLModel):
    username: str
    email: Optional[str] = None
    password: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    role: UserRole = UserRole.EMPLOYEE


class UserUpdate(SQLModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    is_locked: Optional[bool] = None
    force_password_reset: Optional[bool] = None


class UserRead(SQLModel):
    id: UUID
    username: str
    email: Optional[str] = None
    first_name: str
    last_name: str
    phone: Optional[str] = None
    role: UserRole
    hire_date: datetime
    is_active: bool
    is_locked: bool
    force_password_reset: bool
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserPermissionCreate(SQLModel):
    user_id: Optional[UUID] = None
    page: str
    permission: str
    granted: bool = True


class UserPermissionUpdate(SQLModel):
    page: Optional[str] = None
    permission: Optional[str] = None
    granted: Optional[bool] = None


class UserPermissionRead(SQLModel):
    id: UUID
    user_id: UUID
    page: str
    permission: PermissionType
    granted: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class LoginRequest(SQLModel):
    username: str
    password: str
    remember_me: bool = False


class LoginResponse(SQLModel):
    access_token: str
    user: UserRead
    permissions: List[str]


class PasswordResetRequest(SQLModel):
    username: str
    new_password: str


class PasswordChangeRequest(SQLModel):
    current_password: str
    new_password: str
