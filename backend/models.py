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

# Item type classification (keeps legacy values for compatibility)
class ItemType(str, Enum):
    CONSUMABLE = "consumable"
    ITEM = "item"

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

class ClientRead(SQLModel):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

# Item model
class Item(BaseModel, table=True):
    name: str = Field(unique=True, index=True)  # Item names must be unique
    sku: str = Field(unique=True, index=True)
    price: float = Field(ge=0)
    description: Optional[str] = Field(default=None)
    # Store as string in DB to tolerate legacy values; routers coerce to ItemType for API
    type: str = Field(default="item")
    
    # Relationships
    inventory: Optional["Inventory"] = Relationship(back_populates="item")

# Item read model (exclude relationships for API responses)
class ItemRead(SQLModel):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    name: str
    sku: str
    price: float
    description: Optional[str] = None
    type: ItemType = ItemType.ITEM

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

class InventoryRead(SQLModel):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    item_id: UUID
    supplier_id: Optional[UUID] = None
    quantity: int
    min_stock_level: int
    location: Optional[str] = None

# Supplier model
class Supplier(BaseModel, table=True):
    name: str = Field(index=True)
    contact_person: Optional[str] = Field(default=None)
    email: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None)
    address: Optional[str] = Field(default=None)
    
    # Relationships
    inventory_items: List[Inventory] = Relationship(back_populates="supplier")

class SupplierRead(SQLModel):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

# Service model
class Service(BaseModel, table=True):
    name: str = Field(unique=True, index=True)  # Service names must be unique
    description: Optional[str] = Field(default=None)
    category: Optional[str] = Field(default=None)
    price: float = Field(ge=0)
    duration_minutes: int = Field(ge=0, default=60)
    
    # Relationships
    schedules: List["Schedule"] = Relationship(back_populates="service")

class ServiceRead(SQLModel):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    price: float
    duration_minutes: int

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

class ScheduleRead(SQLModel):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    client_id: UUID
    service_id: UUID
    employee_id: UUID
    appointment_date: datetime
    status: str
    notes: Optional[str] = None

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

class AttendanceRead(SQLModel):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    user_id: UUID  # Now only references user
    date: datetime
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    total_hours: Optional[float] = None
    notes: Optional[str] = None

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

# Document read schema for API responses
class DocumentRead(SQLModel):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    filename: str
    original_filename: str
    file_path: str
    file_size: int
    content_type: str
    # Use string for entity_type to be tolerant of legacy values
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    description: Optional[str] = None
    is_signed: bool = False
    signed_by: Optional[str] = None
    signed_at: Optional[datetime] = None
    owner_id: Optional[UUID] = None
    review_date: Optional[datetime] = None
    category_id: Optional[UUID] = None

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

class ItemUpdate(SQLModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    # Accept either enum value/name as string or ItemType; router will normalize
    type: Optional[Union[ItemType, str]] = None

class ServiceCreate(SQLModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    price: float
    duration_minutes: int = 60

class ServiceUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    duration_minutes: Optional[int] = None

# EmployeeCreate removed - now using UserCreate

class ScheduleCreate(SQLModel):
    # Accept strings or UUIDs; router will normalize
    client_id: Union[UUID, str]
    service_id: Union[UUID, str]
    employee_id: Union[UUID, str]
    # Accept strings or datetime; router will normalize
    appointment_date: Union[datetime, str]
    notes: Optional[str] = None

class AttendanceCreate(SQLModel):
    user_id: UUID  # Now references user directly
    date: datetime
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None

# Document update schema
class DocumentUpdate(SQLModel):
    description: Optional[str] = None
    owner_id: Optional[UUID] = None
    review_date: Optional[datetime] = None
    category_id: Optional[UUID] = None

# Document Category model
class DocumentCategory(BaseModel, table=True):
    __tablename__ = "document_category"
    name: str = Field(unique=True, index=True)
    description: Optional[str] = Field(default=None)


# Document Assignment model (many-to-many: document -> user)
class DocumentAssignment(BaseModel, table=True):
    __tablename__ = "document_assignment"
    document_id: UUID = Field(foreign_key="document.id")
    user_id: UUID = Field(foreign_key="user.id")


# Document History model (versioned files)
class DocumentHistory(BaseModel, table=True):
    __tablename__ = "document_history"
    document_id: UUID = Field(foreign_key="document.id")
    version: int
    file_path: str
    file_size: int
    content_type: str
    note: Optional[str] = Field(default=None)

class DocumentAssignmentRead(SQLModel):
    id: UUID
    created_at: datetime
    document_id: UUID
    user_id: UUID

class DocumentAssignmentCreate(SQLModel):
    user_id: UUID

# Read schemas
class DocumentHistoryRead(SQLModel):
    id: UUID
    created_at: datetime
    version: int
    file_path: str
    file_size: int
    content_type: str
    note: Optional[str] = None

class DocumentCategoryRead(SQLModel):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    name: str
    description: Optional[str] = None

class DocumentCategoryCreate(SQLModel):
    name: str
    description: Optional[str] = None

class DocumentCategoryUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None

# Authentication models
class UserCreate(SQLModel):
    username: str
    email: Optional[str] = None  # Made optional
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
    hire_date: Optional[datetime] = None
    is_active: Optional[bool] = None
    is_locked: Optional[bool] = None
    force_password_reset: Optional[bool] = None

class UserRead(SQLModel):
    id: UUID
    username: str
    email: Optional[str] = None  # Made optional
    first_name: str
    last_name: str
    phone: Optional[str] = None
    role: UserRole
    hire_date: Optional[datetime] = None  # Made optional to handle admin user
    is_active: bool
    is_locked: bool
    force_password_reset: bool
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Employee permission fields (optional, only present if user has linked employee)
    clients_read: Optional[bool] = None
    clients_write: Optional[bool] = None
    clients_delete: Optional[bool] = None
    clients_admin: Optional[bool] = None
    
    inventory_read: Optional[bool] = None
    inventory_write: Optional[bool] = None
    inventory_delete: Optional[bool] = None
    inventory_admin: Optional[bool] = None
    
    services_read: Optional[bool] = None
    services_write: Optional[bool] = None
    services_delete: Optional[bool] = None
    services_admin: Optional[bool] = None
    
    employees_read: Optional[bool] = None
    employees_write: Optional[bool] = None
    employees_delete: Optional[bool] = None
    employees_admin: Optional[bool] = None
    
    schedule_read: Optional[bool] = None
    schedule_write: Optional[bool] = None
    schedule_delete: Optional[bool] = None
    schedule_admin: Optional[bool] = None
    schedule_view_all: Optional[bool] = None
    
    attendance_read: Optional[bool] = None
    attendance_write: Optional[bool] = None
    attendance_delete: Optional[bool] = None
    attendance_admin: Optional[bool] = None
    
    documents_read: Optional[bool] = None
    documents_write: Optional[bool] = None
    documents_delete: Optional[bool] = None
    documents_admin: Optional[bool] = None
    
    admin_read: Optional[bool] = None
    admin_write: Optional[bool] = None
    admin_delete: Optional[bool] = None
    admin_admin: Optional[bool] = None

class LoginRequest(SQLModel):
    username: str
    password: str
    remember_me: bool = False

class LoginResponse(SQLModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
    permissions: List[str]

class PasswordResetRequest(SQLModel):
    username: str
    new_password: str

class PasswordChangeRequest(SQLModel):
    current_password: str
    new_password: str

class UserPermissionCreate(SQLModel):
    # Optional: allow specifying the target user in the request body as well as in the URL
    user_id: Optional[Union[UUID, str]] = None
    page: str
    permission: PermissionType
    granted: bool = True

class UserPermissionUpdate(SQLModel):
    permission: Optional[PermissionType] = None
    granted: Optional[bool] = None

class UserPermissionRead(SQLModel):
    id: UUID
    page: str
    permission: PermissionType
    granted: bool
    created_at: datetime

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
