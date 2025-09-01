import pandas as pd
import os

def extract_excel_to_csv():
    excel_file = 'data/Salon Manager.xlsx'
    
    # Extract Clients sheet
    clients_df = pd.read_excel(excel_file, sheet_name='Clients')
    clients_df = clients_df.dropna(subset=['Name'])  # Remove rows without names
    clients_df = clients_df.rename(columns={
        'Name': 'name',
        'Email': 'email', 
        'Number': 'phone'
    })
    clients_df = clients_df[['name', 'email', 'phone']]  # Select only needed columns
    clients_df.to_csv('data/clients.csv', index=False)
    print(f"Clients CSV created with {len(clients_df)} records")
    
    # Extract Services sheet
    services_df = pd.read_excel(excel_file, sheet_name='Services')
    services_df = services_df.dropna(subset=['Service'])  # Remove rows without service names
    
    # Combine Service, Type, and Length into name
    services_df['name'] = services_df['Service'].astype(str)
    services_df.loc[services_df['Type'].notna(), 'name'] = services_df['Service'].astype(str) + ' - ' + services_df['Type'].astype(str)
    services_df.loc[services_df['Length'].notna() & (services_df['Length'] != 'All'), 'name'] = services_df['name'] + ' (' + services_df['Length'].astype(str) + ')'
    
    services_df = services_df.rename(columns={
        'Category': 'category',
        'Price': 'price',
        'Duration': 'duration'
    })
    services_df = services_df[['name', 'category', 'price', 'duration']]  # Select only needed columns
    services_df.to_csv('data/services.csv', index=False)
    print(f"Services CSV created with {len(services_df)} records")

if __name__ == "__main__":
    extract_excel_to_csv()
