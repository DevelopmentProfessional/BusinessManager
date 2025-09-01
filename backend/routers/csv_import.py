from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlmodel import Session, select
from database import get_session
from models import Client, Service, ClientCreate, ServiceCreate
import pandas as pd
import io
from typing import List

router = APIRouter()

def parse_duration_to_minutes(duration_str: str) -> int:
    """Convert duration string (HH:MM:SS) to minutes"""
    if pd.isna(duration_str) or duration_str == '':
        return 60  # Default to 1 hour
    
    try:
        # Handle different duration formats
        if ':' in str(duration_str):
            parts = str(duration_str).split(':')
            if len(parts) == 3:  # HH:MM:SS
                hours, minutes, seconds = map(int, parts)
                return hours * 60 + minutes + (seconds // 60)
            elif len(parts) == 2:  # MM:SS
                minutes, seconds = map(int, parts)
                return minutes + (seconds // 60)
        else:
            # Assume it's just minutes
            return int(float(duration_str))
    except:
        return 60  # Default fallback

@router.post("/clients/upload-csv")
async def upload_clients_csv(
    file: UploadFile = File(...),
    session: Session = Depends(get_session)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    content = await file.read()
    df = pd.read_csv(io.StringIO(content.decode('utf-8')))
    
    # Validate required columns
    required_columns = ['name', 'email', 'phone']
    if not all(col in df.columns for col in required_columns):
        raise HTTPException(
            status_code=400, 
            detail=f"CSV must contain columns: {', '.join(required_columns)}"
        )
    
    created_count = 0
    skipped_count = 0
    
    for _, row in df.iterrows():
        # Skip rows with empty names
        if pd.isna(row['name']) or str(row['name']).strip() == '':
            skipped_count += 1
            continue
            
        # Check if client already exists
        existing = session.exec(
            select(Client).where(Client.name == str(row['name']).strip())
        ).first()
        
        if existing:
            skipped_count += 1
            continue
        
        # Create new client
        client_data = ClientCreate(
            name=str(row['name']).strip(),
            email=str(row['email']).strip() if not pd.isna(row['email']) else None,
            phone=str(row['phone']).strip() if not pd.isna(row['phone']) else None
        )
        
        client = Client(**client_data.dict())
        session.add(client)
        created_count += 1
    
    session.commit()
    
    return {
        "message": f"Import completed. Created: {created_count}, Skipped: {skipped_count}",
        "created": created_count,
        "skipped": skipped_count
    }

@router.post("/services/upload-csv")
async def upload_services_csv(
    file: UploadFile = File(...),
    session: Session = Depends(get_session)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    content = await file.read()
    df = pd.read_csv(io.StringIO(content.decode('utf-8')))
    
    # Validate required columns
    required_columns = ['name', 'category', 'price', 'duration']
    if not all(col in df.columns for col in required_columns):
        raise HTTPException(
            status_code=400, 
            detail=f"CSV must contain columns: {', '.join(required_columns)}"
        )
    
    created_count = 0
    skipped_count = 0
    
    for _, row in df.iterrows():
        # Skip rows with empty names
        if pd.isna(row['name']) or str(row['name']).strip() == '':
            skipped_count += 1
            continue
            
        # Check if service already exists
        existing = session.exec(
            select(Service).where(Service.name == str(row['name']).strip())
        ).first()
        
        if existing:
            skipped_count += 1
            continue
        
        # Create new service
        service_data = ServiceCreate(
            name=str(row['name']).strip(),
            category=str(row['category']).strip() if not pd.isna(row['category']) else None,
            price=float(row['price']) if not pd.isna(row['price']) else 0.0,
            duration_minutes=parse_duration_to_minutes(row['duration'])
        )
        
        service = Service(**service_data.dict())
        session.add(service)
        created_count += 1
    
    session.commit()
    
    return {
        "message": f"Import completed. Created: {created_count}, Skipped: {skipped_count}",
        "created": created_count,
        "skipped": skipped_count
    }
