from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from uuid import UUID
from backend.database import get_session
from backend.models import Client, ClientCreate, ClientUpdate, ClientRead

router = APIRouter()

@router.get("/clients", response_model=List[ClientRead])
async def get_clients(session: Session = Depends(get_session)):
    """Get all clients"""
    clients = session.exec(select(Client)).all()
    return clients

@router.get("/clients/{client_id}", response_model=ClientRead)
async def get_client(client_id: UUID, session: Session = Depends(get_session)):
    """Get a specific client by ID"""
    client = session.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client

@router.post("/clients", response_model=ClientRead)
async def create_client(client_data: ClientCreate, session: Session = Depends(get_session)):
    """Create a new client"""
    # Check for duplicate client name
    existing_client = session.exec(
        select(Client).where(Client.name == client_data.name)
    ).first()
    
    if existing_client:
        raise HTTPException(
            status_code=400, 
            detail=f"A client with the name '{client_data.name}' already exists"
        )
    
    client = Client(**client_data.dict())
    session.add(client)
    session.commit()
    session.refresh(client)
    return client

@router.put("/clients/{client_id}", response_model=ClientRead)
async def update_client(
    client_id: UUID, 
    client_data: ClientUpdate, 
    session: Session = Depends(get_session)
):
    """Update a client"""
    client = session.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    client_dict = client_data.dict(exclude_unset=True)
    
    # Check for duplicate client name if name is being updated
    if 'name' in client_dict:
        existing_client = session.exec(
            select(Client).where(
                Client.name == client_dict['name'],
                Client.id != client_id
            )
        ).first()
        
        if existing_client:
            raise HTTPException(
                status_code=400, 
                detail=f"A client with the name '{client_dict['name']}' already exists"
            )
    
    for key, value in client_dict.items():
        setattr(client, key, value)
    
    session.add(client)
    session.commit()
    session.refresh(client)
    return client

@router.delete("/clients/{client_id}")
async def delete_client(client_id: UUID, session: Session = Depends(get_session)):
    """Delete a client"""
    client = session.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    session.delete(client)
    session.commit()
    return {"message": "Client deleted successfully"}
