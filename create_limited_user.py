#!/usr/bin/env python3

"""
Create a test user with limited schedule permissions
"""

import requests
import json
import sys

# API configuration
BASE_URL = "http://localhost:8000/api/v1"

def test_login_admin():
    """Login as admin to create test user"""
    login_data = {
        "username": "admin",
        "password": "admin123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token")
        else:
            print(f"Admin login failed: {response.text}")
            return None
    except Exception as e:
        print(f"Admin login error: {e}")
        return None

def create_limited_user(admin_token):
    """Create a user with only schedule:write permission"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    user_data = {
        "username": "scheduler_limited",
        "password": "test123",
        "email": "scheduler@test.com",
        "first_name": "Limited",
        "last_name": "Scheduler",
        "role": "employee"
    }
    
    try:
        # Create user
        response = requests.post(f"{BASE_URL}/auth/users", json=user_data, headers=headers)
        print(f"Create user response ({response.status_code}):", response.text)
        
        if response.status_code in [200, 201]:
            user_data_response = response.json()
            user_id = user_data_response.get("id")
            
            # Grant limited schedule permissions
            permissions_data = {
                "page": "schedule",
                "permission": "write"  # Only basic write, not write_all
            }
            
            perm_response = requests.post(f"{BASE_URL}/auth/users/{user_id}/permissions", json=permissions_data, headers=headers)
            print(f"Add permission response ({perm_response.status_code}):", perm_response.text)
            
            # Also grant schedule:read for basic access
            permissions_data["permission"] = "read"
            perm_response = requests.post(f"{BASE_URL}/auth/users/{user_id}/permissions", json=permissions_data, headers=headers)
            print(f"Add read permission response ({perm_response.status_code}):", perm_response.text)
            
            return user_id
        else:
            return None
    except Exception as e:
        print(f"Create user error: {e}")
        return None

def test_limited_user():
    """Test login and schedule access with limited user"""
    login_data = {
        "username": "scheduler_limited",
        "password": "test123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        print(f"\nLimited user login response ({response.status_code}):", response.text)
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            user = data.get("user")
            
            print(f"Logged in as: {user['username']} (role: {user['role']})")
            print(f"Permissions: {data.get('permissions', [])}")
            
            # Test schedule employees endpoint
            headers = {"Authorization": f"Bearer {token}"}
            response = requests.get(f"{BASE_URL}/schedule/employees", headers=headers)
            print(f"\nSchedule employees response ({response.status_code}):")
            
            if response.status_code == 200:
                employees = response.json()
                print(json.dumps(employees, indent=2))
                print(f"Limited user can see {len(employees)} employee(s)")
            else:
                print(response.text)
                
            return token, user
        else:
            return None, None
    except Exception as e:
        print(f"Limited user test error: {e}")
        return None, None

def main():
    print("Creating and Testing Limited Schedule User")
    print("=" * 50)
    
    # Login as admin
    admin_token = test_login_admin()
    if not admin_token:
        print("Failed to login as admin")
        return
    
    # Create limited user
    print("\n1. Creating limited user...")
    user_id = create_limited_user(admin_token)
    if not user_id:
        print("Failed to create limited user")
        return
    
    print(f"Created user with ID: {user_id}")
    
    # Test limited user
    print("\n2. Testing limited user access...")
    token, user = test_limited_user()
    
    if token and user:
        print("\nTest completed successfully!")
        print(f"Limited user '{user['username']}' should only see themselves in the employee dropdown")
    else:
        print("Test failed")

if __name__ == "__main__":
    main()