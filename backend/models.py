from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List, Union
from datetime import datetime
from uuid import UUID, uuid4
from enum import Enum
import bcrypt

class EntityType(str, Enum):
    CLIENT = "client"
    INVENTORY = "inventory"  # Changed from ITEM
    EMPLOYEE = "employee"
    ASSET = "asset"


class ItemType(str, Enum):
    PRODUCT = "product"
    RESOURCE = "resource"
    ASSET = "asset"
    LOCATION = "location"
    ITEM = "item"  # Legacy value for backward compatibility


class AttendanceStatus(str, Enum):
    CLOCK_IN = "clock_in"
    CLOCK_OUT = "clock_out"


class MembershipTier(str, Enum):
    NONE = "none"
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    PLATINUM = "platinum"


class AppointmentType(str, Enum):
    ONE_TIME = "one_time"
    SERIES = "series"
    MEETING = "meeting"
    TASK = "task"


class RecurrenceFrequency(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"


class TaskPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


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
    db_environment: str = Field(default="development")  # User's preferred database environment

    # Hierarchy - who this user reports to
    reports_to: Optional[UUID] = Field(default=None, foreign_key="user.id")

    # Role assignment - links to Role model for inherited permissions
    role_id: Optional[UUID] = Field(default=None, foreign_key="role.id")

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


# Role model - defines a role with attached permissions
class Role(BaseModel, table=True):
    name: str = Field(unique=True, index=True)  # e.g., "Manager", "Receptionist"
    description: Optional[str] = Field(default=None)
    is_system: bool = Field(default=False)  # System roles cannot be deleted

    # Relationships
    role_permissions: List["RolePermission"] = Relationship(back_populates="role")


# RolePermission model - permissions attached to a role
class RolePermission(BaseModel, table=True):
    __tablename__ = "role_permission"
    role_id: UUID = Field(foreign_key="role.id")
    page: str  # e.g., "clients", "inventory", "employees"
    permission: PermissionType

    # Relationships
    role: Role = Relationship(back_populates="role_permissions")


# Client model
class Client(BaseModel, table=True):
    name: str = Field(unique=True, index=True)  # Client names must be unique
    email: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None)
    address: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None)

    # Membership fields
    membership_tier: MembershipTier = Field(default=MembershipTier.NONE)
    membership_since: Optional[datetime] = Field(default=None)
    membership_expires: Optional[datetime] = Field(default=None)
    membership_points: int = Field(default=0)

    # Relationships
    schedules: List["Schedule"] = Relationship(back_populates="client")


# Inventory model (standalone - replaces Item model)
class Inventory(BaseModel, table=True):
    # Product/Item fields (merged from former Item model)
    name: str = Field(index=True)
    sku: str = Field(unique=True, index=True)
    price: float = Field(ge=0, default=0)
    description: Optional[str] = Field(default=None)
    type: str = Field(default="product")  # Use string to avoid PostgreSQL enum issues
    image_url: Optional[str] = Field(default=None)  # Legacy field - kept for backward compatibility
    
    # Inventory-specific fields
    supplier_id: Optional[UUID] = Field(foreign_key="supplier.id", default=None)
    quantity: int = Field(ge=0, default=0)
    min_stock_level: int = Field(ge=0, default=10)
    location: Optional[str] = Field(default=None)
    
    # Service link - for resources/assets tied to specific services
    service_id: Optional[UUID] = Field(foreign_key="service.id", default=None)
    
    # Relationships
    supplier: Optional["Supplier"] = Relationship(back_populates="inventory_items")
    images: List["InventoryImage"] = Relationship(back_populates="inventory_item")


class InventoryImage(BaseModel, table=True):
    """Model for storing multiple images per inventory item"""
    inventory_id: UUID = Field(foreign_key="inventory.id", index=True)
    image_url: Optional[str] = Field(default=None)  # For URL-based images
    file_path: Optional[str] = Field(default=None)  # For uploaded file images
    file_name: Optional[str] = Field(default=None)  # Original filename
    is_primary: bool = Field(default=False)  # Whether this is the primary image
    sort_order: int = Field(default=0)  # For ordering images
    
    # Relationships
    inventory_item: Inventory = Relationship(back_populates="images")


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
    image_url: Optional[str] = Field(default=None)  # URL or path to service image
    
    # Relationships
    schedules: List["Schedule"] = Relationship(back_populates="service")


# Employee model
# Employee model removed - now using User model directly

# Schedule model - matches actual database schema
class Schedule(BaseModel, table=True):
    # Core fields that exist in database
    client_id: Optional[UUID] = Field(foreign_key="client.id", default=None)
    service_id: Optional[UUID] = Field(foreign_key="service.id", default=None)
    employee_id: UUID = Field(foreign_key="user.id")
    appointment_date: datetime
    status: str = Field(default="scheduled")
    notes: Optional[str] = Field(default=None)

    # Relationships
    client: Optional[Client] = Relationship(back_populates="schedules")
    service: Optional[Service] = Relationship(back_populates="schedules")
    employee: "User" = Relationship(back_populates="schedules")


# Schedule Attendee model (for meetings with multiple participants)
class ScheduleAttendee(BaseModel, table=True):
    __tablename__ = "schedule_attendee"
    schedule_id: UUID = Field(foreign_key="schedule.id")
    user_id: Optional[UUID] = Field(foreign_key="user.id", default=None)
    client_id: Optional[UUID] = Field(foreign_key="client.id", default=None)
    attendance_status: str = Field(default="pending")


# Schedule Document link model
class ScheduleDocument(BaseModel, table=True):
    __tablename__ = "schedule_document"
    schedule_id: UUID = Field(foreign_key="schedule.id")
    document_id: UUID = Field(foreign_key="document.id")


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


# App Settings model (singleton pattern for global settings)
class AppSettings(BaseModel, table=True):
    __tablename__ = "app_settings"
    start_of_day: str = Field(default="06:00")  # HH:MM format
    end_of_day: str = Field(default="21:00")  # HH:MM format
    attendance_check_in_required: bool = Field(default=True)
    # Days of operation (True = business operates on this day)
    monday_enabled: bool = Field(default=True)
    tuesday_enabled: bool = Field(default=True)
    wednesday_enabled: bool = Field(default=True)
    thursday_enabled: bool = Field(default=True)
    friday_enabled: bool = Field(default=True)
    saturday_enabled: bool = Field(default=True)
    sunday_enabled: bool = Field(default=True)


# Document model (table name and types aligned with PostgreSQL schema)
class Document(BaseModel, table=True):
    __tablename__ = "document"
    filename: str
    original_filename: str
    file_path: str
    file_size: int = Field(ge=0)
    content_type: str
    # Use str to match PG varchar/enum; API and DB both use string values
    entity_type: Optional[str] = Field(default=None)
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


class DocumentRead(SQLModel):
    """Schema for reading document records (excludes relationship fields)."""
    id: UUID
    filename: str
    original_filename: str
    file_path: str
    file_size: int
    content_type: str
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    description: Optional[str] = None
    is_signed: bool = False
    signed_by: Optional[str] = None
    signed_at: Optional[datetime] = None
    owner_id: Optional[UUID] = None
    review_date: Optional[datetime] = None
    category_id: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DocumentAssignment(BaseModel, table=True):
    """Junction table linking documents to employees, clients, or inventory items."""
    __tablename__ = "document_assignment"
    document_id: UUID = Field(foreign_key="document.id", index=True)
    entity_type: str = Field(index=True)   # "employee", "client", "inventory"
    entity_id: UUID = Field(index=True)
    assigned_by: Optional[UUID] = Field(foreign_key="user.id", default=None)
    notes: Optional[str] = Field(default=None)


class DocumentAssignmentRead(SQLModel):
    """Schema for reading document assignment records."""
    id: UUID
    document_id: UUID
    entity_type: str
    entity_id: UUID
    assigned_by: Optional[UUID] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# Request/Response models for API
class ClientCreate(SQLModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    membership_tier: Optional[MembershipTier] = MembershipTier.NONE
    membership_since: Optional[datetime] = None
    membership_expires: Optional[datetime] = None
    membership_points: Optional[int] = 0


class ClientUpdate(SQLModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    membership_tier: Optional[MembershipTier] = None
    membership_since: Optional[datetime] = None
    membership_expires: Optional[datetime] = None
    membership_points: Optional[int] = None


class ClientRead(SQLModel):
    id: UUID
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    membership_tier: Optional[str] = None
    membership_since: Optional[datetime] = None
    membership_expires: Optional[datetime] = None
    membership_points: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_safe(cls, obj):
        # Handle membership_tier which could be an enum or a string
        tier = obj.membership_tier
        if tier is not None:
            tier = tier.value if hasattr(tier, 'value') else str(tier)

        return cls(
            id=obj.id,
            name=obj.name,
            email=obj.email,
            phone=obj.phone,
            address=obj.address,
            notes=obj.notes,
            membership_tier=tier,
            membership_since=obj.membership_since,
            membership_expires=obj.membership_expires,
            membership_points=obj.membership_points or 0,
            created_at=obj.created_at,
            updated_at=obj.updated_at
        )


class InventoryCreate(SQLModel):
    """Schema for creating inventory items (replaces ItemCreate)"""
    name: str
    sku: str
    price: float = 0
    description: Optional[str] = None
    type: Optional[Union[ItemType, str]] = "product"
    image_url: Optional[str] = None
    quantity: int = 0
    min_stock_level: int = 10
    location: Optional[str] = None
    supplier_id: Optional[UUID] = None


class ServiceRead(SQLModel):
    """Schema for reading service records (excludes relationship fields)"""
    id: UUID
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    price: float
    duration_minutes: int
    image_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SupplierRead(SQLModel):
    """Schema for reading supplier records (excludes relationship fields)"""
    id: UUID
    name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AttendanceRead(SQLModel):
    """Schema for reading attendance records (excludes relationship fields)"""
    id: UUID
    user_id: UUID
    date: datetime
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    total_hours: Optional[float] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class InventoryRead(SQLModel):
    """Schema for reading inventory items (includes images)"""
    id: UUID
    name: str
    sku: str
    price: float
    description: Optional[str] = None
    type: str
    image_url: Optional[str] = None  # Legacy field
    supplier_id: Optional[UUID] = None
    service_id: Optional[UUID] = None
    quantity: int
    min_stock_level: int
    location: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    images: List["InventoryImageRead"] = []

    model_config = {"from_attributes": True}


class InventoryImageCreate(SQLModel):
    """Schema for creating inventory images"""
    inventory_id: UUID
    image_url: Optional[str] = None
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    is_primary: bool = False
    sort_order: int = 0


class InventoryImageRead(SQLModel):
    """Schema for reading inventory images"""
    id: UUID
    inventory_id: UUID
    image_url: Optional[str] = None
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    is_primary: bool
    sort_order: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class InventoryImageUpdate(SQLModel):
    """Schema for updating inventory images"""
    image_url: Optional[str] = None
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    is_primary: Optional[bool] = None
    sort_order: Optional[int] = None


class UserCreate(SQLModel):
    username: str
    email: Optional[str] = None
    password: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    role: UserRole = UserRole.EMPLOYEE
    reports_to: Optional[UUID] = None
    role_id: Optional[UUID] = None  # Assigned role for inherited permissions


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
    reports_to: Optional[UUID] = None
    role_id: Optional[UUID] = None  # Assigned role for inherited permissions
    dark_mode: Optional[bool] = None
    db_environment: Optional[str] = None  # User's preferred database environment


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
    reports_to: Optional[UUID] = None
    role_id: Optional[UUID] = None  # Assigned role for inherited permissions
    dark_mode: bool = False
    db_environment: str = "development"  # User's preferred database environment
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


# Role request/response models
class RoleCreate(SQLModel):
    name: str
    description: Optional[str] = None


class RoleUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None


class RolePermissionCreate(SQLModel):
    page: str
    permission: str


class RolePermissionRead(SQLModel):
    id: UUID
    role_id: UUID
    page: str
    permission: PermissionType
    created_at: datetime

    model_config = {"from_attributes": True}


class RoleRead(SQLModel):
    id: UUID
    name: str
    description: Optional[str] = None
    is_system: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    role_permissions: List[RolePermissionRead] = []

    model_config = {"from_attributes": True}


# Schedule request/response models
class ScheduleCreate(SQLModel):
    client_id: Optional[UUID] = None
    service_id: Optional[UUID] = None
    employee_id: UUID
    appointment_date: datetime
    status: str = "scheduled"
    notes: Optional[str] = None


class ScheduleUpdate(SQLModel):
    client_id: Optional[UUID] = None
    service_id: Optional[UUID] = None
    employee_id: Optional[UUID] = None
    appointment_date: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ScheduleRead(SQLModel):
    """Schema for reading schedule records (excludes relationship fields)"""
    id: UUID
    client_id: Optional[UUID] = None
    service_id: Optional[UUID] = None
    employee_id: UUID
    appointment_date: datetime
    status: str
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ScheduleAttendeeCreate(SQLModel):
    user_id: Optional[UUID] = None
    client_id: Optional[UUID] = None
    attendance_status: str = "pending"


class ScheduleDocumentLink(SQLModel):
    document_id: UUID


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


# App Settings request/response models
class AppSettingsCreate(SQLModel):
    start_of_day: str = "06:00"
    end_of_day: str = "21:00"
    attendance_check_in_required: bool = True
    monday_enabled: bool = True
    tuesday_enabled: bool = True
    wednesday_enabled: bool = True
    thursday_enabled: bool = True
    friday_enabled: bool = True
    saturday_enabled: bool = True
    sunday_enabled: bool = True


class AppSettingsUpdate(SQLModel):
    start_of_day: Optional[str] = None
    end_of_day: Optional[str] = None
    attendance_check_in_required: Optional[bool] = None
    monday_enabled: Optional[bool] = None
    tuesday_enabled: Optional[bool] = None
    wednesday_enabled: Optional[bool] = None
    thursday_enabled: Optional[bool] = None
    friday_enabled: Optional[bool] = None
    saturday_enabled: Optional[bool] = None
    sunday_enabled: Optional[bool] = None


class AppSettingsRead(SQLModel):
    id: UUID
    start_of_day: str
    end_of_day: str
    attendance_check_in_required: bool
    monday_enabled: bool
    tuesday_enabled: bool
    wednesday_enabled: bool
    thursday_enabled: bool
    friday_enabled: bool
    saturday_enabled: bool
    sunday_enabled: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# Database Connection model for storing multiple database configurations
class DatabaseConnection(BaseModel, table=True):
    name: str = Field(index=True)  # e.g., "Development", "Test", "Production"
    environment: str = Field(index=True)  # e.g., "development", "test", "production"
    host: str
    port: int = Field(default=5432)
    database_name: str
    username: str
    password: str  # Should be encrypted in production
    ssl_mode: str = Field(default="require")  # For Render: require, prefer, disable
    is_active: bool = Field(default=True)
    visible_to_users: bool = Field(default=False)  # Toggle for user visibility
    description: Optional[str] = Field(default=None)
    
    # Additional Render-specific fields
    external_url: Optional[str] = Field(default=None)  # Render external database URL
    internal_url: Optional[str] = Field(default=None)  # Render internal database URL
    
    # Connection pool settings
    pool_size: int = Field(default=10)
    max_overflow: int = Field(default=20)


class DatabaseConnectionCreate(SQLModel):
    name: str
    environment: str
    host: str
    port: int = 5432
    database_name: str
    username: str
    password: str
    ssl_mode: str = "require"
    is_active: bool = True
    visible_to_users: bool = False
    description: Optional[str] = None
    external_url: Optional[str] = None
    internal_url: Optional[str] = None
    pool_size: int = 10
    max_overflow: int = 20


class DatabaseConnectionUpdate(SQLModel):
    name: Optional[str] = None
    environment: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    ssl_mode: Optional[str] = None
    is_active: Optional[bool] = None
    visible_to_users: Optional[bool] = None
    description: Optional[str] = None
    external_url: Optional[str] = None
    internal_url: Optional[str] = None
    pool_size: Optional[int] = None
    max_overflow: Optional[int] = None


class DatabaseConnectionRead(SQLModel):
    id: UUID
    name: str
    environment: str
    host: str
    port: int
    database_name: str
    username: str
    password: str  # In production, consider masking this
    ssl_mode: str
    is_active: bool
    visible_to_users: bool
    description: Optional[str] = None
    external_url: Optional[str] = None
    internal_url: Optional[str] = None
    pool_size: int
    max_overflow: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# TaskLink model for linking tasks together (many-to-many)
class TaskLink(BaseModel, table=True):
    __tablename__ = "task_link"
    source_task_id: UUID = Field(foreign_key="task.id")
    target_task_id: UUID = Field(foreign_key="task.id")
    link_type: Optional[str] = Field(default="related")  # related, blocks, blocked_by, depends_on, etc.
    
    # Relationships
    source_task: Optional["Task"] = Relationship(
        back_populates="linked_tasks",
        sa_relationship_kwargs={"foreign_keys": "[TaskLink.source_task_id]"}
    )
    target_task: Optional["Task"] = Relationship(
        back_populates="reverse_linked_tasks",
        sa_relationship_kwargs={"foreign_keys": "[TaskLink.target_task_id]"}
    )

# Task model
class Task(BaseModel, table=True):
    title: str = Field(index=True)  # Task title (not unique, allowing multiple tasks with same title)
    description: Optional[str] = Field(default=None)
    status: str = Field(default="pending")  # pending, in_progress, completed, cancelled
    priority: Optional[str] = Field(default="medium")  # low, medium, high
    due_date: Optional[datetime] = Field(default=None)
    assigned_to_id: Optional[UUID] = Field(foreign_key="user.id", default=None)
    
    # Relationships
    assigned_to: Optional["User"] = Relationship()
    linked_tasks: List["TaskLink"] = Relationship(
        back_populates="source_task",
        sa_relationship_kwargs={"foreign_keys": "[TaskLink.source_task_id]"}
    )
    reverse_linked_tasks: List["TaskLink"] = Relationship(
        back_populates="target_task",
        sa_relationship_kwargs={"foreign_keys": "[TaskLink.target_task_id]"}
    )

class TaskRead(SQLModel):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    title: str
    description: Optional[str] = None
    status: str
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    assigned_to_id: Optional[UUID] = None
    linked_task_titles: Optional[List[str]] = None  # Titles of linked tasks

class TaskCreate(SQLModel):
    title: str
    description: Optional[str] = None
    status: Optional[str] = "pending"
    priority: Optional[str] = "medium"
    due_date: Optional[datetime] = None
    assigned_to_id: Optional[UUID] = None
    linked_task_titles: Optional[List[str]] = None  # List of task titles to link to

class TaskUpdate(SQLModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    assigned_to_id: Optional[UUID] = None
    linked_task_titles: Optional[List[str]] = None  # List of task titles to link to

class TaskLinkRead(SQLModel):
    id: UUID
    created_at: datetime
    source_task_id: UUID
    target_task_id: UUID
    source_task_title: Optional[str] = None
    target_task_title: Optional[str] = None
    link_type: Optional[str] = None
