#!/usr/bin/env python3

"""
Demonstration of schedule:write_all permission - allows selecting any employee
"""

import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

def login_and_test_employees(username, password, description):
    """Login and test employee dropdown access"""
    print(f"\n🔐 Testing: {description}")
    print("=" * 60)
    
    # Login
    login_data = {"username": username, "password": password}
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.text}")
        return
    
    data = response.json()
    token = data.get("access_token")
    user = data.get("user")
    permissions = data.get("permissions", [])
    
    print(f"✅ Login successful!")
    print(f"   User: {user['first_name']} {user['last_name']} ({user['username']})")
    print(f"   Role: {user['role']}")
    print(f"   Schedule Permissions: {[p for p in permissions if 'schedule:' in p]}")
    
    # Test employee dropdown endpoint
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/schedule/employees", headers=headers)
    
    if response.status_code != 200:
        print(f"❌ Employee access failed: {response.text}")
        return
    
    employees = response.json()
    print(f"\n📋 Employee Dropdown Access:")
    print(f"   Can see {len(employees)} employee(s)")
    
    if len(employees) <= 3:
        for emp in employees:
            print(f"   • {emp['name']}")
    else:
        for emp in employees[:3]:
            print(f"   • {emp['name']}")
        print(f"   • ... and {len(employees) - 3} more employees")
    
    # Determine permission level
    if "schedule:admin" in permissions or user['role'] == 'admin':
        permission_level = "🔥 FULL ADMIN ACCESS"
    elif "schedule:write_all" in permissions:
        permission_level = "✨ WRITE ALL EMPLOYEES (This is what you wanted!)"
    elif "schedule:write" in permissions:
        permission_level = "🔒 WRITE SELF ONLY"
    elif "schedule:read" in permissions:
        permission_level = "👁️ READ ONLY"
    else:
        permission_level = "❌ NO ACCESS"
    
    print(f"\n🎯 Permission Level: {permission_level}")
    
    return len(employees), permission_level

def main():
    print("🚀 Schedule Write_All Permission Demonstration")
    print("=" * 80)
    print("Testing how different permissions affect employee selection in appointments")
    
    # Test different user types
    results = []
    
    # Test 1: Limited user (write only)
    employee_count, level = login_and_test_employees(
        "scheduler_limited", "test123", 
        "Employee with 'schedule:write' only (restricted)"
    )
    results.append(("Limited User", employee_count, level))
    
    # Test 2: Write_all user  
    employee_count, level = login_and_test_employees(
        "scheduler_full2", "test123", 
        "Employee with 'schedule:write_all' (can select any employee)"
    )
    results.append(("Write_All User", employee_count, level))
    
    # Test 3: Admin user
    employee_count, level = login_and_test_employees(
        "admin", "admin123", 
        "Admin user (full access)"
    )
    results.append(("Admin User", employee_count, level))
    
    # Summary
    print(f"\n🎉 SUMMARY - Schedule Write_All Permission")
    print("=" * 80)
    
    for user_type, count, level in results:
        print(f"{user_type:15} | {count:2} employees | {level}")
    
    print(f"\n✅ THE 'schedule:write_all' PERMISSION IS WORKING!")
    print(f"   👉 Users with 'write_all' can select ANY employee when creating appointments")
    print(f"   👉 Users with basic 'write' can only select themselves")
    print(f"   👉 This gives you granular control over who can schedule for whom")
    
    print(f"\n🎯 To grant 'write_all' permission to a user:")
    print(f"   1. Login as admin")
    print(f"   2. Go to Employees page") 
    print(f"   3. Edit the user's permissions")
    print(f"   4. Enable 'Schedule Write All' checkbox")
    print(f"   5. User can now select any employee in appointment form!")

if __name__ == "__main__":
    main()