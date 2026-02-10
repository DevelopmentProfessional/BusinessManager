from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List
from uuid import UUID

from backend.database import get_session
from backend.models import (
    DatabaseConnection,
    DatabaseConnectionCreate,
    DatabaseConnectionUpdate,
    DatabaseConnectionRead,
    User
)
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/database-connections", tags=["database-connections"])


@router.get("/", response_model=List[DatabaseConnectionRead])
def get_all_connections(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all database connections (admin only)"""
    if current_user.role.value not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and managers can view database connections"
        )
    
    connections = session.exec(select(DatabaseConnection)).all()
    return [DatabaseConnectionRead.model_validate(conn) for conn in connections]


@router.get("/visible", response_model=List[DatabaseConnectionRead])
def get_visible_connections(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get database connections visible to users (for user profile selection)"""
    statement = select(DatabaseConnection).where(
        DatabaseConnection.visible_to_users == True,
        DatabaseConnection.is_active == True
    )
    connections = session.exec(statement).all()
    return [DatabaseConnectionRead.model_validate(conn) for conn in connections]


@router.get("/{connection_id}", response_model=DatabaseConnectionRead)
def get_connection(
    connection_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific database connection by ID"""
    if current_user.role.value not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and managers can view database connections"
        )
    
    connection = session.get(DatabaseConnection, connection_id)
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found"
        )
    
    return DatabaseConnectionRead.model_validate(connection)


@router.post("/", response_model=DatabaseConnectionRead, status_code=status.HTTP_201_CREATED)
def create_connection(
    connection_data: DatabaseConnectionCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new database connection (admin only)"""
    if current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create database connections"
        )
    
    # Create new connection
    new_connection = DatabaseConnection(**connection_data.model_dump())
    session.add(new_connection)
    session.commit()
    session.refresh(new_connection)
    
    return DatabaseConnectionRead.model_validate(new_connection)


@router.patch("/{connection_id}", response_model=DatabaseConnectionRead)
def update_connection(
    connection_id: UUID,
    connection_data: DatabaseConnectionUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a database connection (admin only)"""
    if current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update database connections"
        )
    
    connection = session.get(DatabaseConnection, connection_id)
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found"
        )
    
    # Update fields
    update_data = connection_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(connection, key, value)
    
    session.add(connection)
    session.commit()
    session.refresh(connection)
    
    return DatabaseConnectionRead.model_validate(connection)


@router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_connection(
    connection_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a database connection (admin only)"""
    if current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete database connections"
        )
    
    connection = session.get(DatabaseConnection, connection_id)
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found"
        )
    
    session.delete(connection)
    session.commit()
    
    return None


@router.patch("/{connection_id}/toggle-visibility", response_model=DatabaseConnectionRead)
def toggle_visibility(
    connection_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Toggle the visible_to_users flag for a database connection"""
    if current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can toggle connection visibility"
        )
    
    connection = session.get(DatabaseConnection, connection_id)
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found"
        )
    
    # Toggle visibility
    connection.visible_to_users = not connection.visible_to_users
    session.add(connection)
    session.commit()
    session.refresh(connection)
    
    return DatabaseConnectionRead.model_validate(connection)
