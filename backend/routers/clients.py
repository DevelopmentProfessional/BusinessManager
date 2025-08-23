from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from uuid import UUID
from database import get_session
from models import Client, ClientCreate, ClientUpdate, ClientRead

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
