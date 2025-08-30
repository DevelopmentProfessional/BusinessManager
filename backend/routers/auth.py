from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select
from datetime import datetime, timedelta
from typing import List, Optional
import jwt
import os
import bcrypt
from database import get_session
from models import (
    User, UserCreate, UserUpdate, UserRead, UserPermission, UserPermissionCreate,
    UserPermissionUpdate, UserPermissionRead, LoginRequest, LoginResponse,
    PasswordResetRequest, PasswordChangeRequest, UserRole, PermissionType
)

router = APIRouter()
security = HTTPBearer()

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REMEMBER_ME_EXPIRE_DAYS = 30

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(
    payload: dict = Depends(verify_token),
    session: Session = Depends(get_session)
) -> User:
    """Get current user from token"""
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user.is_locked:
        if user.locked_until and user.locked_until > datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is locked",
                headers={"WWW-Authenticate": "Bearer"},
            )
        else:
            # Unlock account if lock period has expired
            user.is_locked = False
            user.failed_login_attempts = 0
            user.locked_until = None
            session.commit()
    
    return user

def get_user_permissions(user: User, session: Session) -> List[str]:
    """Get user permissions as list of strings"""
    # Admin users have access to everything
    if user.role == UserRole.ADMIN:
        all_pages = ['clients', 'inventory', 'suppliers', 'services', 'employees', 'schedule', 'attendance', 'documents', 'admin']
        all_permissions = ['read', 'write', 'delete', 'admin']
        admin_permissions = []
        for page in all_pages:
            for permission in all_permissions:
                admin_permissions.append(f"{page}:{permission}")
        return admin_permissions
    
    permissions = session.exec(
        select(UserPermission).where(UserPermission.user_id == user.id)
    ).all()
    
    # Convert to list of strings like "clients:read", "inventory:write"
    permission_strings = []
    for perm in permissions:
        if perm.granted:
            permission_strings.append(f"{perm.page}:{perm.permission}")
    
    return permission_strings

def get_user_permissions_list(user: User, session: Session) -> List[str]:
    """Get user permissions as list of strings"""
    # Admin users have access to everything
    if user.role == UserRole.ADMIN:
        all_pages = ['clients', 'inventory', 'suppliers', 'services', 'employees', 'schedule', 'attendance', 'documents', 'admin']
        all_permissions = ['read', 'write', 'delete', 'admin']
        admin_permissions = []
        for page in all_pages:
            for permission in all_permissions:
                admin_permissions.append(f"{page}:{permission}")
        return admin_permissions
    
    permissions = session.exec(
        select(UserPermission).where(UserPermission.user_id == user.id)
    ).all()
    
    # Convert to list of strings like "clients:read", "inventory:write"
    permission_strings = []
    for perm in permissions:
        if perm.granted:
            permission_strings.append(f"{perm.page}:{perm.permission}")
    
    return permission_strings

@router.post("/initialize")
def initialize_admin(session: Session = Depends(get_session)):
    """Initialize admin user if none exists"""
    # Check if any admin user exists
    admin_user = session.exec(select(User).where(User.role == UserRole.ADMIN)).first()
    
    if admin_user:
        return {"message": "Admin user already exists", "username": admin_user.username}
    
    # Create admin user
    password = "admin123"
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    admin_user = User(
        username="admin",
        email="admin@lavishbeautyhairandnail.care",
        hashed_password=hashed_password.decode('utf-8'),
        role=UserRole.ADMIN,
        is_active=True
    )
    
    session.add(admin_user)
    session.commit()
    
    return {
        "message": "Admin user created successfully",
        "username": "admin",
        "password": "admin123",
        "note": "Please change this password after first login"
    }

@router.post("/login", response_model=LoginResponse)
def login(login_data: LoginRequest, session: Session = Depends(get_session)):
    """User login endpoint"""
    # Find user by username or email
    user = session.exec(
        select(User).where(
            (User.username == login_data.username) | (User.email == login_data.username)
        )
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Check if account is locked
    if user.is_locked:
        if user.locked_until and user.locked_until > datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is locked. Please try again later."
            )
        else:
            # Unlock account if lock period has expired
            user.is_locked = False
            user.failed_login_attempts = 0
            user.locked_until = None
    
    # Verify password
    if not user.verify_password(login_data.password):
        user.failed_login_attempts += 1
        
        # Lock account after 5 failed attempts
        if user.failed_login_attempts >= 5:
            user.is_locked = True
            user.locked_until = datetime.utcnow() + timedelta(minutes=30)
            session.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Too many failed attempts. Account locked for 30 minutes."
            )
        
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Reset failed attempts on successful login
    user.failed_login_attempts = 0
    user.last_login = datetime.utcnow()
    user.is_locked = False
    user.locked_until = None
    session.commit()
    
    # Create access token
    expires_delta = timedelta(days=REMEMBER_ME_EXPIRE_DAYS) if login_data.remember_me else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "role": user.role},
        expires_delta=expires_delta
    )
    
    # Get user permissions
    permissions = get_user_permissions_list(user, session)
    
    # Get employee permissions if user has a linked employee account
    employee_permissions = {}
    if user.employee:
        employee = user.employee
        # Convert employee permission fields to the format expected by frontend
        permission_fields = [
            'clients_read', 'clients_write', 'clients_delete', 'clients_admin',
            'inventory_read', 'inventory_write', 'inventory_delete', 'inventory_admin',
            'services_read', 'services_write', 'services_delete', 'services_admin',
            'employees_read', 'employees_write', 'employees_delete', 'employees_admin',
            'schedule_read', 'schedule_write', 'schedule_delete', 'schedule_admin', 'schedule_view_all',
            'attendance_read', 'attendance_write', 'attendance_delete', 'attendance_admin',
            'documents_read', 'documents_write', 'documents_delete', 'documents_admin',
            'admin_read', 'admin_write', 'admin_delete', 'admin_admin'
        ]
        
        for field in permission_fields:
            employee_permissions[field] = getattr(employee, field, False)
    
    # Create user data with employee permissions
    user_data = UserRead.from_orm(user)
    if employee_permissions:
        # Update the user_data object with employee permissions
        for field, value in employee_permissions.items():
            setattr(user_data, field, value)
    
    return LoginResponse(
        access_token=access_token,
        user=user_data,
        permissions=permissions
    )

@router.post("/logout")
def logout():
    """User logout endpoint (client should discard token)"""
    return {"message": "Successfully logged out"}

@router.post("/reset-password")
def reset_password(reset_data: PasswordResetRequest, session: Session = Depends(get_session)):
    """Reset user password"""
    user = session.exec(
        select(User).where(User.username == reset_data.username)
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not user.force_password_reset:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset not required"
        )
    
    # Update password
    user.password_hash = User.hash_password(reset_data.new_password)
    user.force_password_reset = False
    user.is_locked = False
    user.failed_login_attempts = 0
    user.locked_until = None
    session.commit()
    
    return {"message": "Password reset successfully"}

@router.post("/change-password")
def change_password(
    password_data: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Change user password with current password verification"""
    # Verify current password
    if not current_user.verify_password(password_data.current_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Update password
    current_user.password_hash = User.hash_password(password_data.new_password)
    current_user.updated_at = datetime.utcnow()
    session.commit()
    
    return {"message": "Password changed successfully"}

@router.get("/me", response_model=UserRead)
def get_current_user_info(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get current user information"""
    # Get employee permissions if user has a linked employee account
    employee_permissions = {}
    if current_user.employee:
        employee = current_user.employee
        # Convert employee permission fields to the format expected by frontend
        permission_fields = [
            'clients_read', 'clients_write', 'clients_delete', 'clients_admin',
            'inventory_read', 'inventory_write', 'inventory_delete', 'inventory_admin',
            'services_read', 'services_write', 'services_delete', 'services_admin',
            'employees_read', 'employees_write', 'employees_delete', 'employees_admin',
            'schedule_read', 'schedule_write', 'schedule_delete', 'schedule_admin', 'schedule_view_all',
            'attendance_read', 'attendance_write', 'attendance_delete', 'attendance_admin',
            'documents_read', 'documents_write', 'documents_delete', 'documents_admin',
            'admin_read', 'admin_write', 'admin_delete', 'admin_admin'
        ]
        
        for field in permission_fields:
            employee_permissions[field] = getattr(employee, field, False)
    
    # Create user data with employee permissions
    user_data = UserRead.from_orm(current_user)
    if employee_permissions:
        # Update the user_data object with employee permissions
        for field, value in employee_permissions.items():
            setattr(user_data, field, value)
    
    return user_data

@router.get("/me/permissions")
def get_current_user_permissions(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get current user permissions"""
    permissions = get_user_permissions(current_user, session)
    return {"permissions": permissions}

# Admin endpoints for user management
@router.post("/users", response_model=UserRead)
def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Create a new user (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    # Check if username or email already exists
    existing_user = session.exec(
        select(User).where(
            (User.username == user_data.username) | (User.email == user_data.email)
        )
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already exists"
        )
    
    # Create new user
    user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=User.hash_password(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        role=user_data.role
    )
    
    session.add(user)
    session.commit()
    session.refresh(user)
    
    return UserRead.from_orm(user)

@router.get("/users", response_model=List[UserRead])
def get_users(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get all users (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    users = session.exec(select(User)).all()
    return [UserRead.from_orm(user) for user in users]

@router.get("/users/{user_id}", response_model=UserRead)
def get_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get specific user (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserRead.from_orm(user)

@router.put("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: str,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Update user (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update user fields
    for field, value in user_data.dict(exclude_unset=True).items():
        if field == 'password':
            # Hash the password before storing
            user.password_hash = User.hash_password(value)
        else:
            setattr(user, field, value)
    
    user.updated_at = datetime.utcnow()
    session.commit()
    session.refresh(user)
    
    return UserRead.from_orm(user)

@router.post("/users/{user_id}/lock")
def lock_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Lock user account (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.is_locked = True
    user.locked_until = datetime.utcnow() + timedelta(hours=24)  # Lock for 24 hours
    session.commit()
    
    return {"message": "User account locked"}

@router.post("/users/{user_id}/unlock")
def unlock_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Unlock user account (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.is_locked = False
    user.locked_until = None
    user.failed_login_attempts = 0
    session.commit()
    
    return {"message": "User account unlocked"}

@router.post("/users/{user_id}/force-password-reset")
def force_password_reset(
    user_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Force user to reset password on next login (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.force_password_reset = True
    user.is_locked = True  # Lock account until password is reset
    session.commit()
    
    return {"message": "User will be required to reset password on next login"}

# Permission management endpoints
@router.post("/users/{user_id}/permissions", response_model=UserPermissionRead)
def create_user_permission(
    user_id: str,
    permission_data: UserPermissionCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Create user permission (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if permission already exists
    existing_permission = session.exec(
        select(UserPermission).where(
            (UserPermission.user_id == user_id) &
            (UserPermission.page == permission_data.page) &
            (UserPermission.permission == permission_data.permission)
        )
    ).first()
    
    if existing_permission:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Permission already exists"
        )
    
    permission = UserPermission(
        user_id=user_id,
        page=permission_data.page,
        permission=permission_data.permission,
        granted=permission_data.granted
    )
    
    session.add(permission)
    session.commit()
    session.refresh(permission)
    
    return UserPermissionRead.from_orm(permission)

@router.get("/users/{user_id}/permissions", response_model=List[UserPermissionRead])
def get_user_permissions(
    user_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get user permissions (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    permissions = session.exec(
        select(UserPermission).where(UserPermission.user_id == user_id)
    ).all()
    
    return [UserPermissionRead.from_orm(perm) for perm in permissions]

@router.put("/users/{user_id}/permissions/{permission_id}", response_model=UserPermissionRead)
def update_user_permission(
    user_id: str,
    permission_id: str,
    permission_data: UserPermissionUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Update user permission (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    permission = session.get(UserPermission, permission_id)
    if not permission or permission.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    
    # Update permission fields
    for field, value in permission_data.dict(exclude_unset=True).items():
        setattr(permission, field, value)
    
    session.commit()
    session.refresh(permission)
    
    return UserPermissionRead.from_orm(permission)

@router.delete("/users/{user_id}/permissions/{permission_id}")
def delete_user_permission(
    user_id: str,
    permission_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Delete user permission (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    permission = session.get(UserPermission, permission_id)
    if not permission or permission.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    
    session.delete(permission)
    session.commit()
    
    return {"message": "Permission deleted"}
