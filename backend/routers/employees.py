from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from backend.database import get_session
from backend.models import User, UserCreate, UserRead, UserUpdate, UserPermission, UserPermissionCreate
from backend.routers.auth import get_current_user
from backend.models import UserRole

router = APIRouter()

@router.get("/employees", response_model=List[UserRead])
async def get_employees(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all employees (users)"""
    # Get all users (employees and admins)
    users = session.exec(select(User)).all()
    return users

@router.get("/employees/{employee_id}", response_model=UserRead)
async def get_employee(
    employee_id: UUID, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific employee by ID"""
    user = session.get(User, employee_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("/employees", response_model=UserRead)
async def create_employee(
    employee_data: dict, 
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Create a new employee (user account)"""
    # Check if current user has permission
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Extract user data
    user_fields = {
        'username': employee_data.get('username'),
        'first_name': employee_data.get('first_name'),
        'last_name': employee_data.get('last_name'),
        'email': employee_data.get('email'),  # Optional
        'phone': employee_data.get('phone'),
        'role': UserRole.EMPLOYEE,  # Default to EMPLOYEE
        'is_active': employee_data.get('is_active', True)
    }
    
    # Validate required fields
    username = employee_data.get('username')
    password = employee_data.get('password')
    
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required")
    
    if not user_fields['first_name'] or not user_fields['last_name']:
        raise HTTPException(status_code=400, detail="First name and last name are required")
    
    # Parse hire_date if provided
    if 'hire_date' in employee_data:
        try:
            if isinstance(employee_data['hire_date'], str):
                user_fields['hire_date'] = datetime.fromisoformat(employee_data['hire_date'].replace('Z', '+00:00'))
            else:
                user_fields['hire_date'] = employee_data['hire_date']
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid hire_date format")
    else:
        user_fields['hire_date'] = datetime.utcnow()
    
    # Check for duplicate username
    existing_user = session.exec(select(User).where(User.username == username)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail=f"Username '{username}' already exists")
    
    # Check for duplicate email if provided
    if user_fields.get('email'):
        existing_email = session.exec(select(User).where(User.email == user_fields['email'])).first()
        if existing_email:
            raise HTTPException(status_code=400, detail=f"Email '{user_fields['email']}' already exists")
    
    # Hash password
    user_fields['password_hash'] = User.hash_password(password)
    
    # Create the user
    user = User(**user_fields)
    session.add(user)
    session.commit()
    session.refresh(user)
    
    return user

@router.put("/employees/{employee_id}", response_model=UserRead)
async def update_employee(
    employee_id: UUID, 
    employee_data: dict,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Update an employee"""
    # Check if current user has permission
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get the user
    user = session.get(User, employee_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update fields
    if 'first_name' in employee_data:
        user.first_name = employee_data['first_name']
    if 'last_name' in employee_data:
        user.last_name = employee_data['last_name']
    if 'email' in employee_data:
        # Check for duplicate email if changing
        if employee_data['email'] and employee_data['email'] != user.email:
            existing_email = session.exec(select(User).where(User.email == employee_data['email'])).first()
            if existing_email:
                raise HTTPException(status_code=400, detail=f"Email '{employee_data['email']}' already exists")
        user.email = employee_data['email']
    if 'phone' in employee_data:
        user.phone = employee_data['phone']
    if 'role' in employee_data:
        user.role = UserRole(employee_data['role'])
    if 'is_active' in employee_data:
        user.is_active = employee_data['is_active']
    if 'hire_date' in employee_data:
        try:
            if isinstance(employee_data['hire_date'], str):
                user.hire_date = datetime.fromisoformat(employee_data['hire_date'].replace('Z', '+00:00'))
            else:
                user.hire_date = employee_data['hire_date']
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid hire_date format")
    
    # Update password if provided
    if 'password' in employee_data and employee_data['password']:
        user.password_hash = User.hash_password(employee_data['password'])
    
    # Update username if provided
    if 'username' in employee_data and employee_data['username'] != user.username:
        existing_user = session.exec(select(User).where(User.username == employee_data['username'])).first()
        if existing_user:
            raise HTTPException(status_code=400, detail=f"Username '{employee_data['username']}' already exists")
        user.username = employee_data['username']
    
    user.updated_at = datetime.utcnow()
    session.add(user)
    session.commit()
    session.refresh(user)
    
    return user

@router.delete("/employees/{employee_id}")
async def delete_employee(
    employee_id: UUID,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Delete an employee"""
    # Check if current user has permission
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Prevent self-deletion
    if employee_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Get the user
    user = session.get(User, employee_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete associated permissions first
    permissions = session.exec(select(UserPermission).where(UserPermission.user_id == employee_id)).all()
    for permission in permissions:
        session.delete(permission)
    
    # Delete the user
    session.delete(user)
    session.commit()
    
    return {"message": "User deleted successfully"}