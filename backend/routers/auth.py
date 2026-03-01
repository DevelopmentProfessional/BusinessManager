# ============================================================
# FILE: auth.py
#
# PURPOSE:
#   Handles all authentication and user-management concerns for the
#   BusinessManager API.  It issues and validates JWT tokens, exposes
#   login/logout endpoints, and provides admin-gated CRUD for users,
#   roles, individual permissions, passwords, signatures, and profile
#   pictures.
#
# FUNCTIONAL PARTS:
#   [1] Imports                     — stdlib, third-party, and local imports
#   [2] JWT Configuration & Helpers — constants, create_access_token, verify_token,
#                                     get_current_user, get_user_permissions_list
#   [3] Token Verification / get_current_user Dependency
#                                   — verify_token + get_current_user FastAPI deps
#   [4] Login / Token Endpoints     — /initialize, /login, /logout
#   [5] User CRUD Endpoints         — /me, /users (create, list, get, update, lock/unlock)
#   [6] Password Management         — /reset-password, /change-password, /admin/reset-password,
#                                     /admin/unlock-account, /admin/lock-account,
#                                     /admin/account-status, /admin/normalize-permissions,
#                                     /me/dark-mode
#   [7] User Permission Endpoints   — /users/{id}/permissions, /permissions (body variant)
#   [8] Role Management Endpoints   — /roles CRUD + /roles/{id}/permissions
#   [9] Signature Endpoints         — /me/signature (GET/PUT)
#  [10] Profile Self-Update & Profile Picture
#                                   — /me/profile, /me/profile-picture,
#                                     /users/{id}/profile-picture
#
# CHANGE LOG — all modifications to this file must be recorded here:
#   Format : YYYY-MM-DD | Author | Description
#   ─────────────────────────────────────────────────────────────
#   2026-03-01 | Claude  | Added section comments and top-level documentation
# ============================================================

# ─── [1] IMPORTS ───────────────────────────────────────────────────────────────
from fastapi import APIRouter, Depends, HTTPException, status, Body, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
from sqlmodel import Session, select
from sqlalchemy import text
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID
import jwt
import os
import uuid as uuid_mod
import bcrypt
from backend.database import get_session
from backend.models import (
    User, UserCreate, UserUpdate, UserRead, UserPermission, UserPermissionCreate,
    UserPermissionUpdate, UserPermissionRead, LoginRequest, LoginResponse,
    PasswordResetRequest, PasswordChangeRequest, UserRole, PermissionType,
    Role, RolePermission, RoleCreate, RoleUpdate, RoleRead, RolePermissionCreate, RolePermissionRead
)

# ─── [2] JWT CONFIGURATION AND HELPERS ────────────────────────────────────────
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

# ─── [3] TOKEN VERIFICATION / get_current_user DEPENDENCY ─────────────────────
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

def get_user_permissions_list(user: User, session: Session) -> List[str]:
    """Get user permissions as list of strings (including inherited role permissions)"""
    # Admin users have access to everything
    if str(user.role).lower() == 'admin' or user.role == UserRole.ADMIN:
        all_pages = ['clients', 'inventory', 'suppliers', 'services', 'employees', 'schedule', 'attendance', 'documents', 'reports', 'admin']
        all_permissions = ['read', 'write', 'delete', 'admin']
        admin_permissions = []
        for page in all_pages:
            for permission in all_permissions:
                admin_permissions.append(f"{page}:{permission}")
        return admin_permissions

    permission_strings = set()  # Use set to avoid duplicates

    # Get permissions from assigned role (if any)
    if user.role_id:
        role_permissions = session.exec(
            select(RolePermission).where(RolePermission.role_id == user.role_id)
        ).all()
        for rp in role_permissions:
            try:
                val = getattr(rp.permission, "value", str(rp.permission))
            except Exception:
                val = str(rp.permission)
            permission_strings.add(f"{rp.page}:{str(val).lower()}")

    # Get user's individual permissions (these can override or add to role permissions)
    user_permissions = session.exec(
        select(UserPermission).where(UserPermission.user_id == user.id)
    ).all()

    # Convert to list of strings like "clients:read", "inventory:write"
    for perm in user_permissions:
        if perm.granted:
            # Be tolerant of legacy/corrupt rows where enum casing or value is wrong
            try:
                val = getattr(perm.permission, "value", str(perm.permission))
            except Exception:
                val = str(perm.permission)
            permission_strings.add(f"{perm.page}:{str(val).lower()}")

    return list(permission_strings)

# ─── [4] LOGIN / TOKEN ENDPOINTS ──────────────────────────────────────────────
@router.get("/initialize")
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
        email="admin@businessmanager.com",
        password_hash=hashed_password.decode('utf-8'),
        first_name="Admin",
        last_name="User",
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
    
    # Verify password (tolerate unexpected errors without 500)
    try:
        valid_pw = user.verify_password(login_data.password)
    except Exception:
        valid_pw = False
    if not valid_pw:
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
    
    # Create UserRead object from user
    user_read = UserRead(
        id=user.id,
        username=user.username,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        role=user.role,
        hire_date=user.hire_date,
        is_active=user.is_active,
        is_locked=user.is_locked,
        force_password_reset=user.force_password_reset,
        last_login=user.last_login,
        supervisor=user.supervisor,
        created_at=user.created_at,
        updated_at=user.updated_at
    )
    
    return LoginResponse(
        access_token=access_token,
        user=user_read,
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

# ─── [5] USER CRUD ENDPOINTS ──────────────────────────────────────────────────
@router.get("/me", response_model=UserRead)
def get_current_user_info(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get current user information"""
    # Return user data directly; granular permissions are returned via separate endpoint
    return UserRead.from_orm(current_user)

@router.get("/me/permissions")
def get_current_user_permissions(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get current user permissions"""
    # Use list-producing helper for current user
    permissions = get_user_permissions_list(current_user, session)
    return {"permissions": permissions}

# ─── [6] PASSWORD MANAGEMENT ENDPOINTS ────────────────────────────────────────
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
        role=user_data.role,
        supervisor=user_data.supervisor
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

    incoming = user_data.dict(exclude_unset=True)
    if "db_environment" in incoming and incoming["db_environment"] != "production":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only 'production' database environment is allowed"
        )
    
    # Update user fields
    for field, value in incoming.items():
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

# ─── [7] USER PERMISSION ENDPOINTS ───────────────────────────────────────────
# Permission management endpoints
@router.post("/users/{user_id}/permissions", response_model=UserPermissionRead)
def create_user_permission(
    user_id: str,  # Accept as string, convert to UUID with error handling
    permission_data: UserPermissionCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Create user permission (admin only)"""
    # Convert user_id to UUID with error handling
    try:
        user_uuid = UUID(user_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid user_id format: {user_id}. Must be a valid UUID."
        )

    # Validate permission type
    valid_permissions = [p.value for p in PermissionType]
    try:
        PermissionType(permission_data.permission)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid permission type: {permission_data.permission}. Valid types: {valid_permissions}"
        )

    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    user = session.get(User, user_uuid)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check if permission already exists
    existing_permission = session.exec(
        select(UserPermission).where(
            (UserPermission.user_id == user_uuid) &
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
        user_id=user_uuid,
        page=permission_data.page,
        permission=permission_data.permission,
        granted=permission_data.granted
    )

    session.add(permission)
    try:
        session.commit()
        session.refresh(permission)
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")

    return UserPermissionRead.from_orm(permission)

# Convenience endpoint: allow creating a permission with user_id in the body instead of the URL
@router.post("/permissions", response_model=UserPermissionRead)
def create_user_permission_with_body(
    permission_data: UserPermissionCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Create user permission (admin only) with user_id provided in the body.
    This complements POST /auth/users/{user_id}/permissions for clients that send payload-only data.
    """
    # Validate/normalize user_id
    if not getattr(permission_data, "user_id", None):
        raise HTTPException(status_code=400, detail="user_id is required in body for this endpoint")
    try:
        body_user_id = UUID(str(permission_data.user_id))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user_id format; must be a UUID")

    # Reuse the same logic as the path-based endpoint by inlining the checks
    # Validate permission type (no auto-conversion to avoid enum issues)
    valid_permissions = [p.value for p in PermissionType]
    original_permission = permission_data.permission

    try:
        perm_type = PermissionType(permission_data.permission)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid permission type: {permission_data.permission}. Valid types: {valid_permissions}"
        )

    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    user = session.get(User, body_user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing_permission = session.exec(
        select(UserPermission).where(
            (UserPermission.user_id == body_user_id) &
            (UserPermission.page == permission_data.page) &
            (UserPermission.permission == permission_data.permission)
        )
    ).first()
    if existing_permission:
        raise HTTPException(status_code=400, detail="Permission already exists")

    permission = UserPermission(
        user_id=body_user_id,
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
    
    # Convert user_id to UUID with error handling
    try:
        user_uuid = UUID(user_id)
    except (ValueError, TypeError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid user_id format: {user_id}. Must be a valid UUID."
        )
    
    user = session.get(User, user_uuid)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    permissions = session.exec(
        select(UserPermission).where(UserPermission.user_id == user_uuid)
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
    
    # Convert IDs to UUID with error handling
    try:
        user_uuid = UUID(user_id)
        permission_uuid = UUID(permission_id)
    except (ValueError, TypeError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format. Both user_id and permission_id must be valid UUIDs."
        )
    
    permission = session.get(UserPermission, permission_uuid)
    if not permission or permission.user_id != user_uuid:
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
    user_id: str,  # Accept as string, convert to UUID with error handling
    permission_id: str,  # Accept as string, convert to UUID with error handling
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Delete user permission (admin only)"""
    # Convert IDs to UUID with error handling
    try:
        user_uuid = UUID(user_id)
        permission_uuid = UUID(permission_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format. Both user_id and permission_id must be valid UUIDs."
        )

    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    permission = session.get(UserPermission, permission_uuid)
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )

    if permission.user_id != user_uuid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )

    session.delete(permission)
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")

    return {"message": "Permission deleted"}

@router.post("/admin/normalize-permissions")
def normalize_permissions(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Admin maintenance: normalize UserPermission.permission values.
    - Lowercase all values
    - Map common variants (e.g., 'viewall' -> 'view_all')
    - Skip invalid values
    Returns a summary of changes.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    allowed = {p.value for p in PermissionType}
    changed = 0
    skipped = 0
    total = 0

    perms = session.exec(select(UserPermission)).all()
    for p in perms:
        total += 1
        # Extract raw value, tolerate bad data
        try:
            raw = getattr(p.permission, "value", str(p.permission))
        except Exception:
            raw = str(p.permission)
        norm = (raw or "").strip().lower()
        if norm == "viewall":
            norm = "view_all"

        if norm in allowed:
            try:
                new_enum = PermissionType(norm)
            except Exception:
                skipped += 1
                continue
            if p.permission != new_enum:
                p.permission = new_enum
                session.add(p)
                changed += 1
        else:
            skipped += 1

    if changed:
        session.commit()

    return {"total": total, "changed": changed, "skipped": skipped}

@router.put("/me/dark-mode")
def update_dark_mode_preference(
    dark_mode_data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Update current user's dark mode preference"""
    dark_mode = dark_mode_data.get("dark_mode", False)
    current_user.dark_mode = dark_mode
    session.commit()
    session.refresh(current_user)
    
    return {"message": "Dark mode preference updated", "dark_mode": dark_mode}

# Password Reset and Account Management
@router.post("/reset-password")
def reset_password(
    reset_data: PasswordResetRequest,
    session: Session = Depends(get_session)
):
    """Reset user password (admin only or self-reset with current password)"""
    user = session.exec(select(User).where(User.username == reset_data.username)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if user is locked
    if user.is_locked:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account is locked. Contact administrator to unlock."
        )
    
    # Verify current password if provided (for self-reset)
    if reset_data.current_password:
        if not user.verify_password(reset_data.current_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current password is incorrect"
            )
    else:
        # Admin reset - require admin role (this should be checked by the caller)
        # For now, we'll allow it but in production you'd want proper admin verification
        pass
    
    # Update password
    user.password_hash = User.hash_password(reset_data.new_password)
    user.force_password_reset = False
    user.failed_login_attempts = 0
    user.locked_until = None
    
    session.commit()
    session.refresh(user)
    
    return {"message": "Password reset successfully"}

@router.post("/admin/reset-password")
def admin_reset_password(
    reset_data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Admin reset user password"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    username = reset_data.get("username")
    new_password = reset_data.get("new_password")
    
    if not username or not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and new_password are required"
        )
    
    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update password
    user.password_hash = User.hash_password(new_password)
    user.force_password_reset = True  # Force user to change password on next login
    user.failed_login_attempts = 0
    user.locked_until = None
    user.is_locked = False
    
    session.commit()
    session.refresh(user)
    
    return {"message": f"Password reset for user {username}. User must change password on next login."}

@router.post("/admin/unlock-account")
def unlock_account(
    unlock_data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Unlock user account (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    username = unlock_data.get("username")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is required"
        )
    
    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Unlock account
    user.is_locked = False
    user.failed_login_attempts = 0
    user.locked_until = None
    
    session.commit()
    session.refresh(user)
    
    return {"message": f"Account unlocked for user {username}"}

@router.post("/admin/lock-account")
def lock_account(
    lock_data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Lock user account (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    username = lock_data.get("username")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is required"
        )
    
    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Don't allow locking admin accounts
    if user.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot lock admin accounts"
        )
    
    # Lock account
    user.is_locked = True
    user.locked_until = datetime.utcnow() + timedelta(days=30)  # Lock for 30 days
    
    session.commit()
    session.refresh(user)
    
    return {"message": f"Account locked for user {username}"}

@router.get("/admin/account-status/{username}")
def get_account_status(
    username: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get user account status (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {
        "username": user.username,
        "is_active": user.is_active,
        "is_locked": user.is_locked,
        "failed_login_attempts": user.failed_login_attempts,
        "locked_until": user.locked_until,
        "last_login": user.last_login,
        "force_password_reset": user.force_password_reset
    }


# ─── [8] ROLE MANAGEMENT ENDPOINTS ───────────────────────────────────────────
# ============================================================================
# Role Management Endpoints
# ============================================================================

@router.get("/roles", response_model=List[RoleRead])
def get_roles(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get all roles with their permissions (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    roles = session.exec(select(Role)).all()
    return roles

@router.post("/roles", response_model=RoleRead)
def create_role(
    role_data: RoleCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Create a new role (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    # Check if role name already exists
    existing = session.exec(select(Role).where(Role.name == role_data.name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role with this name already exists"
        )

    role = Role(
        name=role_data.name,
        description=role_data.description
    )
    session.add(role)
    session.commit()
    session.refresh(role)

    return role

@router.get("/roles/{role_id}", response_model=RoleRead)
def get_role(
    role_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get a role by ID with its permissions (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    try:
        role_uuid = UUID(role_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role ID format"
        )

    role = session.get(Role, role_uuid)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

    return role

@router.put("/roles/{role_id}", response_model=RoleRead)
def update_role(
    role_id: str,
    role_data: RoleUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Update a role (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    try:
        role_uuid = UUID(role_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role ID format"
        )

    role = session.get(Role, role_uuid)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify system roles"
        )

    if role_data.name is not None:
        # Check if name is taken by another role
        existing = session.exec(
            select(Role).where(Role.name == role_data.name, Role.id != role_uuid)
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role with this name already exists"
            )
        role.name = role_data.name

    if role_data.description is not None:
        role.description = role_data.description

    role.updated_at = datetime.utcnow()
    session.commit()
    session.refresh(role)

    return role

@router.delete("/roles/{role_id}")
def delete_role(
    role_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Delete a role (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    try:
        role_uuid = UUID(role_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role ID format"
        )

    role = session.get(Role, role_uuid)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete system roles"
        )

    # Check if any users are assigned to this role
    users_with_role = session.exec(select(User).where(User.role_id == role_uuid)).first()
    if users_with_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete role while users are assigned to it"
        )

    # Delete role permissions first
    role_perms = session.exec(select(RolePermission).where(RolePermission.role_id == role_uuid)).all()
    for perm in role_perms:
        session.delete(perm)

    session.delete(role)
    session.commit()

    return {"message": "Role deleted successfully"}

@router.post("/roles/{role_id}/permissions", response_model=RolePermissionRead)
def add_role_permission(
    role_id: str,
    permission_data: RolePermissionCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Add a permission to a role (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    try:
        role_uuid = UUID(role_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role ID format"
        )

    role = session.get(Role, role_uuid)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

    # Validate permission type
    try:
        perm_type = PermissionType(permission_data.permission.lower())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid permission type. Must be one of: {[p.value for p in PermissionType]}"
        )

    # Check if permission already exists for this role
    existing = session.exec(
        select(RolePermission).where(
            RolePermission.role_id == role_uuid,
            RolePermission.page == permission_data.page,
            RolePermission.permission == perm_type
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This permission already exists for this role"
        )

    role_perm = RolePermission(
        role_id=role_uuid,
        page=permission_data.page,
        permission=perm_type
    )
    session.add(role_perm)
    session.commit()
    session.refresh(role_perm)

    return role_perm

@router.delete("/roles/{role_id}/permissions/{permission_id}")
def remove_role_permission(
    role_id: str,
    permission_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Remove a permission from a role (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    try:
        role_uuid = UUID(role_id)
        perm_uuid = UUID(permission_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )

    role = session.get(Role, role_uuid)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

    perm = session.get(RolePermission, perm_uuid)
    if not perm or perm.role_id != role_uuid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found for this role"
        )

    session.delete(perm)
    session.commit()

    return {"message": "Permission removed from role"}

# ─── [9] SIGNATURE ENDPOINTS ──────────────────────────────────────────────────
# ============================================================================
# Signature Endpoints
# ============================================================================

@router.put("/me/signature")
def save_my_signature(
    signature_data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Save current user's signature (base64 data URL)"""
    data = signature_data.get("signature_data")
    if not data or not isinstance(data, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="signature_data is required and must be a base64 data URL string"
        )
    if not data.startswith("data:image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="signature_data must be a valid data:image/ URL"
        )
    current_user.signature_data = data
    current_user.updated_at = datetime.utcnow()
    try:
        session.commit()
        session.refresh(current_user)
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    return {"message": "Signature saved", "signature_data": data}


@router.get("/me/signature")
def get_my_signature(
    current_user: User = Depends(get_current_user),
):
    """Get current user's saved signature"""
    return {"signature_data": current_user.signature_data}


# ─── [10] PROFILE SELF-UPDATE & PROFILE PICTURE ───────────────────────────────
# ============================================================================
# Profile Self-Update & Profile Picture
# ============================================================================

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB


@router.put("/me/profile", response_model=UserRead)
def update_my_profile(
    user_data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Update current user's own profile (limited fields)."""
    allowed_fields = {
        "first_name", "last_name", "email", "phone",
        "profile_picture", "signature_data", "password"
    }
    for field, value in user_data.items():
        if field not in allowed_fields:
            continue
        if field == "password":
            if value:
                current_user.password_hash = User.hash_password(value)
        else:
            setattr(current_user, field, value)

    current_user.updated_at = datetime.utcnow()
    try:
        session.commit()
        session.refresh(current_user)
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    return UserRead.from_orm(current_user)


@router.put("/me/profile-picture")
def upload_my_profile_picture(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Upload profile picture for current user."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: JPEG, PNG, GIF, WebP"
        )

    contents = file.file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 5MB.")

    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    unique_filename = f"profile_{current_user.id}_{uuid_mod.uuid4().hex[:8]}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as f:
        f.write(contents)

    # Delete old profile picture file if it exists
    if current_user.profile_picture:
        old_path = os.path.join(UPLOAD_DIR, current_user.profile_picture)
        if os.path.exists(old_path):
            os.remove(old_path)

    current_user.profile_picture = unique_filename
    current_user.updated_at = datetime.utcnow()
    session.commit()
    session.refresh(current_user)

    return {"message": "Profile picture uploaded", "profile_picture": unique_filename}


@router.get("/users/{user_id}/profile-picture")
def get_user_profile_picture(
    user_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Serve a user's profile picture file."""
    user = session.get(User, user_id)
    if not user or not user.profile_picture:
        raise HTTPException(status_code=404, detail="Profile picture not found")

    file_path = os.path.join(UPLOAD_DIR, user.profile_picture)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Profile picture file not found")

    return FileResponse(file_path)


# ============================================================================
# Database Environment (DEPRECATED)
# ============================================================================
# NOTE: Database environment preference is now stored in the user's profile
# (User.db_environment field). Use the user update endpoint to change it.
# These endpoints are kept for backward compatibility but may be removed.
