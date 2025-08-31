from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from database import get_session
from models import Employee, EmployeeCreate, EmployeeRead, User, UserCreate, UserPermission, UserPermissionCreate
from routers.auth import get_current_user
from models import UserRole

router = APIRouter()

@router.get("/employees", response_model=List[EmployeeRead])
async def get_employees(session: Session = Depends(get_session)):
    """Get all employees"""
    employees = session.exec(select(Employee)).all()
    return employees

@router.get("/employees/{employee_id}", response_model=EmployeeRead)
async def get_employee(employee_id: UUID, session: Session = Depends(get_session)):
    """Get a specific employee by ID"""
    employee = session.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee

@router.post("/employees", response_model=EmployeeRead)
async def create_employee(
    employee_data: dict, 
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Create a new employee with optional user account"""
    # Check if current user is admin
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Extract employee data
    employee_fields = {
        'first_name': employee_data.get('first_name'),
        'last_name': employee_data.get('last_name'),
        'email': employee_data.get('email'),
        'phone': employee_data.get('phone'),
        'role': employee_data.get('role'),
        'is_active': employee_data.get('is_active', True)
    }
    
    # Add permission fields if provided
    permission_fields = [
        'clients_read', 'clients_write', 'clients_delete', 'clients_admin',
        'inventory_read', 'inventory_write', 'inventory_delete', 'inventory_admin',
        'services_read', 'services_write', 'services_delete', 'services_admin',
        'employees_read', 'employees_write', 'employees_delete', 'employees_admin',
        'schedule_read', 'schedule_write', 'schedule_delete', 'schedule_admin',
        'attendance_read', 'attendance_write', 'attendance_delete', 'attendance_admin',
        'documents_read', 'documents_write', 'documents_delete', 'documents_admin',
        'admin_read', 'admin_write', 'admin_delete', 'admin_admin'
    ]
    
    for field in permission_fields:
        if field in employee_data:
            employee_fields[field] = employee_data[field]
    
    # Handle hire_date separately to avoid parsing issues
    hire_date = employee_data.get('hire_date')
    if hire_date:
        try:
            if isinstance(hire_date, str):
                # Remove 'Z' and parse ISO format
                hire_date = hire_date.replace('Z', '+00:00')
                employee_fields['hire_date'] = datetime.fromisoformat(hire_date)
            elif isinstance(hire_date, datetime):
                employee_fields['hire_date'] = hire_date
        except Exception as e:
            print(f"Error parsing hire_date: {hire_date}, error: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Invalid hire_date format: {str(e)}")
    else:
        # Set default hire_date to current date if not provided
        employee_fields['hire_date'] = datetime.utcnow()
    
    # Check for duplicate employee email
    existing_employee = session.exec(
        select(Employee).where(Employee.email == employee_fields['email'])
    ).first()
    
    if existing_employee:
        raise HTTPException(
            status_code=400, 
            detail=f"An employee with the email '{employee_fields['email']}' already exists"
        )
    
    # Create employee
    employee = Employee(**employee_fields)
    session.add(employee)
    session.commit()
    session.refresh(employee)
    
    # Handle user creation if credentials provided
    user_credentials = employee_data.get('user_credentials')
    if user_credentials:
        try:
            # Create user account
            user_fields = {
                'username': user_credentials.get('username'),
                'email': user_credentials.get('email'),
                'password_hash': User.hash_password(user_credentials.get('password')),
                'first_name': employee_fields['first_name'],
                'last_name': employee_fields['last_name'],
                'role': user_credentials.get('role', 'employee'),
                'is_active': user_credentials.get('is_active', True)
            }
            
            # Check for duplicate username
            existing_user_by_username = session.exec(
                select(User).where(User.username == user_fields['username'])
            ).first()
            
            if existing_user_by_username:
                raise HTTPException(
                    status_code=400, 
                    detail=f"A user with the username '{user_fields['username']}' already exists"
                )
            
            # Check for duplicate user email
            existing_user_by_email = session.exec(
                select(User).where(User.email == user_fields['email'])
            ).first()
            
            if existing_user_by_email:
                raise HTTPException(
                    status_code=400, 
                    detail=f"A user with the email '{user_fields['email']}' already exists"
                )
            
            user = User(**user_fields)
            session.add(user)
            session.commit()
            session.refresh(user)
            
            # Link employee to user
            employee.user_id = user.id
            session.add(employee)
            
            # Create permissions if provided
            permissions = user_credentials.get('permissions', [])
            for perm_data in permissions:
                permission = UserPermission(
                    user_id=user.id,
                    page=perm_data['page'],
                    permission=perm_data['permission'],
                    granted=perm_data.get('granted', True)
                )
                session.add(permission)
            
            session.commit()
            session.refresh(employee)
            
        except Exception as e:
            # Rollback employee creation if user creation fails
            session.rollback()
            raise HTTPException(status_code=400, detail=f"Failed to create user account: {str(e)}")
    
    return employee

@router.put("/employees/{employee_id}", response_model=EmployeeRead)
async def update_employee(
    employee_id: UUID, 
    employee_data: dict, 
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Update employee information"""
    try:
        print(f"=== UPDATE EMPLOYEE REQUEST ===")
        print(f"Employee ID: {employee_id}")
        print(f"Current User: {current_user.username} (role: {current_user.role})")
        print(f"Employee Data: {employee_data}")
        
        # Check if current user is admin
        if current_user.role != "admin":
            print(f"Access denied: User {current_user.username} is not admin")
            raise HTTPException(status_code=403, detail="Admin access required")
        
        employee = session.get(Employee, employee_id)
        if not employee:
            print(f"Employee {employee_id} not found")
            raise HTTPException(status_code=404, detail="Employee not found")
        
        print(f"Found employee: {employee.first_name} {employee.last_name}")
        
        # Check if this is a permission-only update
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
        
        # Check if this is a permission-only update
        is_permission_only = all(key in permission_fields for key in employee_data.keys())
        
        if is_permission_only:
            print("Permission-only update detected")
            # For permission-only updates, don't require basic fields
        else:
            # For full updates, validate required fields
            if not employee_data.get('first_name') or not employee_data.get('last_name') or not employee_data.get('email'):
                print(f"Missing required fields: first_name={employee_data.get('first_name')}, last_name={employee_data.get('last_name')}, email={employee_data.get('email')}")
                raise HTTPException(status_code=400, detail="First name, last name, and email are required")
            
            # Update employee fields
            print(f"Updating employee fields...")
            employee.first_name = employee_data.get('first_name')
            employee.last_name = employee_data.get('last_name')
            employee.email = employee_data.get('email')
            employee.phone = employee_data.get('phone', employee.phone)
            employee.role = employee_data.get('role', employee.role)
            employee.is_active = employee_data.get('is_active', employee.is_active)
        
        # Update permission fields if provided
        for field in permission_fields:
            if field in employee_data:
                setattr(employee, field, employee_data[field])
                print(f"Updated {field} to: {employee_data[field]}")
        
        # Handle hire_date
        hire_date = employee_data.get('hire_date')
        if hire_date:
            try:
                if isinstance(hire_date, str):
                    # Remove 'Z' and parse ISO format
                    hire_date = hire_date.replace('Z', '+00:00')
                    employee.hire_date = datetime.fromisoformat(hire_date)
                    print(f"Updated hire_date to: {employee.hire_date}")
                elif isinstance(hire_date, datetime):
                    employee.hire_date = hire_date
                    print(f"Updated hire_date to: {employee.hire_date}")
            except Exception as e:
                print(f"Error parsing hire_date: {hire_date}, error: {str(e)}")
                # Keep existing hire_date if parsing fails
                pass
        
        # Update the updated_at timestamp
        employee.updated_at = datetime.utcnow()
        
        print(f"About to commit changes...")
        session.add(employee)
        session.commit()
        session.refresh(employee)
        
        print(f"Successfully updated employee {employee_id}")
        print(f"Updated employee: {employee.first_name} {employee.last_name} ({employee.email})")
        return employee
        
    except HTTPException as http_ex:
        print(f"HTTP Exception: {http_ex.status_code} - {http_ex.detail}")
        raise
    except Exception as e:
        session.rollback()
        print(f"Unexpected error updating employee {employee_id}: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to update employee: {str(e)}")

@router.delete("/employees/{employee_id}")
async def delete_employee(
    employee_id: UUID, 
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Delete an employee (admin only)"""
    # Check if current user is admin
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    employee = session.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    employee.is_active = False  # Soft delete
    session.add(employee)
    session.commit()
    return {"message": "Employee deactivated successfully"}

@router.put("/employees/{employee_id}/user-account")
async def update_employee_user_account(
    employee_id: UUID,
    user_data: dict,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Update user account for an employee (admin only)"""
    try:
        # Check if current user is admin
        if current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        employee = session.get(Employee, employee_id)
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Check if employee has a linked user
        if not employee.user_id:
            raise HTTPException(status_code=404, detail="Employee has no linked user account")
        
        user = session.get(User, employee.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Linked user account not found")
        
        print(f"Updating user account for employee {employee_id}")
        
        # Validate required fields
        if not user_data.get('username') or not user_data.get('email'):
            raise HTTPException(status_code=400, detail="Username and email are required")
        
        # Update user fields
        user.username = user_data['username']
        user.email = user_data['email']
        user.role = user_data.get('role', user.role)
        user.is_active = user_data.get('is_active', user.is_active)
        
        # Update password if provided
        if user_data.get('password'):
            user.password_hash = User.hash_password(user_data['password'])
        
        user.updated_at = datetime.utcnow()
        session.add(user)
        
        # Update permissions if provided
        if user_data.get('permissions'):
            # Remove existing permissions
            existing_permissions = session.exec(
                select(UserPermission).where(UserPermission.user_id == user.id)
            ).all()
            for perm in existing_permissions:
                session.delete(perm)
            
            # Add new permissions
            for perm_data in user_data['permissions']:
                permission = UserPermission(
                    user_id=user.id,
                    page=perm_data['page'],
                    permission=perm_data['permission'],
                    granted=perm_data.get('granted', True)
                )
                session.add(permission)
        
        session.commit()
        session.refresh(user)
        
        print(f"Successfully updated user account for employee {employee_id}")
        
        return {
            "message": "User account updated successfully",
            "user": {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active
            }
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        session.rollback()
        print(f"Error updating user account for employee {employee_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update user account: {str(e)}")

@router.post("/employees/{employee_id}/user-account")
async def create_employee_user_account(
    employee_id: UUID,
    user_data: dict,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Create user account for an employee (admin only)"""
    # Check if current user is admin
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    employee = session.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    if employee.user_id:
        raise HTTPException(status_code=400, detail="Employee already has a linked user account")
    
    try:
        # Create user account
        user_fields = {
            'username': user_data.get('username'),
            'email': user_data.get('email'),
            'password_hash': User.hash_password(user_data.get('password')),
            'first_name': employee.first_name,
            'last_name': employee.last_name,
            'role': user_data.get('role', 'employee'),
            'is_active': user_data.get('is_active', True)
        }
        
        user = User(**user_fields)
        session.add(user)
        session.commit()
        session.refresh(user)
        
        # Link employee to user
        employee.user_id = user.id
        session.add(employee)
        
        # Create permissions if provided
        permissions = user_data.get('permissions', [])
        for perm_data in permissions:
            permission = UserPermission(
                user_id=user.id,
                page=perm_data['page'],
                permission=perm_data['permission'],
                granted=perm_data.get('granted', True)
            )
            session.add(permission)
        
        session.commit()
        session.refresh(employee)
        
        return {
            "message": "User account created successfully",
            "user": {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active
            }
        }
        
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create user account: {str(e)}")
