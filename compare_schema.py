#!/usr/bin/env python
"""Compare database schema with backend models"""
import json
import re
from backend.models import (
    Inventory, Service, Client, User, SaleTransaction, SaleTransactionItem,
    ClientCartItem, ClientOrderItem, DiscountRule
)
from sqlalchemy import inspect
from backend.database import engine

# Get database schema
inspector = inspect(engine)
db_schema = {}

key_tables = {
    'inventory': Inventory,
    'service': Service,
    'client': Client,
    'user': User,
    'sale_transaction': SaleTransaction,
    'sale_transaction_item': SaleTransactionItem,
    'client_cart_item': ClientCartItem,
    'client_order_item': ClientOrderItem,
    'discount_rule': DiscountRule,
}

for table_name, model_class in key_tables.items():
    cols = {col['name'] for col in inspector.get_columns(table_name)}
    model_fields = {f for f in model_class.model_fields.keys()}
    
    db_only = cols - model_fields
    model_only = model_fields - cols
    
    if db_only or model_only:
        print(f'\n❌ MISMATCH: {table_name}')
        if db_only:
            print(f'   In DB but NOT in model: {sorted(db_only)}')
        if model_only:
            print(f'   In model but NOT in DB: {sorted(model_only)}')
    else:
        print(f'✓ {table_name}: OK')
