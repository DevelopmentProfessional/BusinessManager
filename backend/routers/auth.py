from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select
from sqlalchemy import text
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID
import jwt
import os
import bcrypt
from backend.database import get_session
from backend.models import (
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

def get_user_permissions_list(user: User, session: Session) -> List[str]:
    """Get user permissions as list of strings"""
    # Admin users have access to everything
    if str(user.role).lower() == 'admin' or user.role == UserRole.ADMIN:
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
            # Be tolerant of legacy/corrupt rows where enum casing or value is wrong
            try:
                val = getattr(perm.permission, "value", str(perm.permission))
            except Exception:
                val = str(perm.permission)
            permission_strings.append(f"{perm.page}:{str(val).lower()}")
    
    return permission_strings

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
        email="admin@lavishbeautyhairandnail.care",
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
    user_id: str,  # Accept as string, convert to UUID with error handling
    permission_data: UserPermissionCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Create user permission (admin only)"""
    print(f"🔥 PERMISSION CREATE DEBUG - user_id: {user_id}")
    
    # Convert user_id to UUID with error handling
    try:
        user_uuid = UUID(user_id)
    except (ValueError, TypeError) as e:
        print(f"🔥 PERMISSION CREATE DEBUG - Invalid user_id format: {user_id}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid user_id format: {user_id}. Must be a valid UUID."
        )
    print(f"🔥 PERMISSION CREATE DEBUG - Converted user_id to UUID: {user_uuid}")
    print(f"🔥 PERMISSION CREATE DEBUG - permission_data: {permission_data}")
    print(f"🔥 PERMISSION CREATE DEBUG - permission type: {permission_data.permission}")
    print(f"🔥 PERMISSION CREATE DEBUG - valid permission types: {list(PermissionType)}")
    
    # EMERGENCY: Validate permission type with auto-conversion
    valid_permissions = [p.value for p in PermissionType]
    original_permission = permission_data.permission
    
    # Auto-convert old permission types to new ones
    if permission_data.permission == "write_all":
        permission_data.permission = "view_all"
        print(f"🚨 EMERGENCY AUTO-CONVERT: write_all → view_all")
    elif permission_data.permission == "read" and "read_all" in valid_permissions:
        permission_data.permission = "read_all"
        print(f"🚨 EMERGENCY AUTO-CONVERT: read → read_all")
    
    try:
        # Test if permission type is valid (after conversion)
        perm_type = PermissionType(permission_data.permission)
        print(f"🔥 PERMISSION CREATE DEBUG - Permission type validation passed: {perm_type}")
        if original_permission != permission_data.permission:
            print(f"🚨 CONVERTED {original_permission} → {permission_data.permission}")
    except ValueError as e:
        print(f"🔥 PERMISSION CREATE DEBUG - Invalid permission type: {permission_data.permission}")
        print(f"🔥 PERMISSION CREATE DEBUG - Available types: {valid_permissions}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid permission type: {permission_data.permission}. Valid types: {valid_permissions}"
        )
    
    if current_user.role != UserRole.ADMIN:
        print(f"🔥 PERMISSION CREATE DEBUG - Access denied: {current_user.role} != ADMIN")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    user = session.get(User, user_uuid)
    print(f"🔥 CREATE PERMISSION BACKEND DEBUG - Found user: {user}")
    if not user:
        print(f"🔥 CREATE PERMISSION BACKEND DEBUG - User {user_uuid} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if permission already exists
    print(f"🔥 CREATE PERMISSION BACKEND DEBUG - Checking for existing permission...")
    existing_permission = session.exec(
        select(UserPermission).where(
            (UserPermission.user_id == user_uuid) &
            (UserPermission.page == permission_data.page) &
            (UserPermission.permission == permission_data.permission)
        )
    ).first()
    
    print(f"🔥 CREATE PERMISSION BACKEND DEBUG - Existing permission: {existing_permission}")
    
    if existing_permission:
        print(f"🔥 CREATE PERMISSION BACKEND DEBUG - Permission already exists!")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Permission already exists"
        )
    
    print(f"🔥 CREATE PERMISSION BACKEND DEBUG - Creating new permission...")
    permission = UserPermission(
        user_id=user_uuid,
        page=permission_data.page,
        permission=permission_data.permission,
        granted=permission_data.granted
    )
    
    print(f"🔥 CREATE PERMISSION BACKEND DEBUG - Permission object created: {permission}")
    session.add(permission)
    print(f"🔥 CREATE PERMISSION BACKEND DEBUG - Permission added to session")
    session.commit()
    print(f"🔥 CREATE PERMISSION BACKEND DEBUG - Session committed")
    session.refresh(permission)
    print(f"🔥 CREATE PERMISSION BACKEND DEBUG - Permission refreshed: {permission}")
    
    result = UserPermissionRead.from_orm(permission)
    print(f"🔥 CREATE PERMISSION BACKEND DEBUG - Returning result: {result}")
    return result

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
    # EMERGENCY: Validate permission type with auto-conversion
    valid_permissions = [p.value for p in PermissionType]
    original_permission = permission_data.permission

    if permission_data.permission == "write_all":
        permission_data.permission = "view_all"
        print(f"🚨 EMERGENCY AUTO-CONVERT: write_all → view_all")
    elif permission_data.permission == "read" and "read_all" in valid_permissions:
        permission_data.permission = "read_all"
        print(f"🚨 EMERGENCY AUTO-CONVERT: read → read_all")

    try:
        perm_type = PermissionType(permission_data.permission)
        if original_permission != permission_data.permission:
            print(f"🚨 CONVERTED {original_permission} → {permission_data.permission}")
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
    print(f"🔥 DELETE PERMISSION DEBUG - user_id: {user_id} (type: {type(user_id)})")
    print(f"🔥 DELETE PERMISSION DEBUG - permission_id: {permission_id} (type: {type(permission_id)})")
    
    # Convert IDs to UUID with error handling
    try:
        user_uuid = UUID(user_id)
        permission_uuid = UUID(permission_id)
    except (ValueError, TypeError) as e:
        print(f"🔥 DELETE PERMISSION DEBUG - Invalid ID format: user_id={user_id}, permission_id={permission_id}")
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
    print(f"🔥 DELETE PERMISSION DEBUG - Found permission: {permission}")
    
    if not permission:
        print(f"🔥 DELETE PERMISSION DEBUG - Permission {permission_uuid} not found in database")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    
    print(f"🔥 DELETE PERMISSION DEBUG - permission.user_id: {permission.user_id} (type: {type(permission.user_id)})")
    print(f"🔥 DELETE PERMISSION DEBUG - Comparing {permission.user_id} != {user_uuid}")
    print(f"🔥 DELETE PERMISSION DEBUG - Comparison result: {permission.user_id != user_uuid}")
    
    if permission.user_id != user_uuid:
        print(f"🔥 DELETE PERMISSION DEBUG - User ID mismatch! Permission belongs to {permission.user_id}, not {user_uuid}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    
    print(f"🔥 DELETE PERMISSION DEBUG - Deleting permission {permission_uuid} for user {user_uuid}")
    session.delete(permission)
    session.commit()
    print(f"🔥 DELETE PERMISSION DEBUG - Permission deleted successfully")
    
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
