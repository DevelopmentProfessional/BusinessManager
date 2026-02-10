"""
Verify that document insert works after the entity_type migration.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import create_engine
from sqlmodel import Session
from models import Document

DB_URL = "postgresql+psycopg://db_reference_user:AGONHh5kBrXztl8hwYUEIGpCZncxK06j@dpg-d5scoucoud1c73b1s5tg-a.oregon-postgres.render.com/db_reference_name"
engine = create_engine(DB_URL, pool_pre_ping=True)

# Test 1: Insert without entity_type (like the upload form does)
print("Test 1: Insert without entity_type...")
with Session(engine) as session:
    doc = Document(
        filename="test_verify.txt",
        original_filename="test_verify.txt",
        file_path="/tmp/test_verify.txt",
        file_size=42,
        content_type="text/plain",
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)
    print(f"  SUCCESS! id={doc.id}")
    # Serialize test
    data = doc.model_dump(mode="json")
    print(f"  Serialized OK: filename={data['filename']}, entity_type={data['entity_type']}")
    # Cleanup
    session.delete(doc)
    session.commit()
    print("  Cleaned up.")

# Test 2: Insert with entity_type = "client"
print("\nTest 2: Insert with entity_type='client'...")
with Session(engine) as session:
    doc = Document(
        filename="test_client.txt",
        original_filename="test_client.txt",
        file_path="/tmp/test_client.txt",
        file_size=100,
        content_type="text/plain",
        entity_type="client",
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)
    print(f"  SUCCESS! id={doc.id}, entity_type={doc.entity_type}")
    session.delete(doc)
    session.commit()
    print("  Cleaned up.")

# Test 3: Insert with description
print("\nTest 3: Insert with description...")
with Session(engine) as session:
    doc = Document(
        filename="test_desc.pdf",
        original_filename="test_desc.pdf",
        file_path="/tmp/test_desc.pdf",
        file_size=2048,
        content_type="application/pdf",
        description="Test document with description",
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)
    print(f"  SUCCESS! id={doc.id}, description={doc.description}")
    session.delete(doc)
    session.commit()
    print("  Cleaned up.")

print("\nAll tests passed!")
