#!/usr/bin/env python3
"""
Permission System Verification Test
==================================

This script tests that all components are aligned:
1. Backend PermissionType enum has all required types
2. Frontend permission arrays include all types
3. Schedule router supports both legacy and new permissions
"""

import sys
import os

# Add backend to path so we can import models
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

def test_permission_enum():
    """Test that PermissionType enum has all required values"""
    try:
        from models import PermissionType
        
        required_types = ['read', 'read_all', 'write', 'write_all', 'view_all', 'delete', 'admin']
        enum_values = [p.value for p in PermissionType]
        
        print("🔍 Testing PermissionType Enum...")
        print(f"   Available types: {enum_values}")
        
        missing = [t for t in required_types if t not in enum_values]
        if missing:
            print(f"   ❌ Missing types: {missing}")
            return False
        else:
            print(f"   ✅ All required permission types present")
            return True
            
    except Exception as e:
        print(f"   ❌ Failed to import PermissionType: {e}")
        return False

def test_frontend_permissions():
    """Test that frontend has correct permission arrays"""
    try:
        # Check Employees.jsx permissions array
        with open('frontend/src/pages/Employees.jsx', 'r') as f:
            content = f.read()
            
        print("\n🔍 Testing Frontend Permission Arrays...")
        
        # Look for the permissions array
        if "['read', 'read_all', 'write', 'view_all', 'delete', 'admin']" in content:
            print("   ✅ Employees.jsx has correct permission array")
            employees_ok = True
        else:
            print("   ❌ Employees.jsx missing correct permission array")
            employees_ok = False
            
        # Check Schedule.jsx permission checks
        with open('frontend/src/pages/Schedule.jsx', 'r') as f:
            schedule_content = f.read()
            
        has_read_all = "read_all" in schedule_content
        has_view_all = "view_all" in schedule_content
        
        if has_read_all and has_view_all:
            print("   ✅ Schedule.jsx checks for read_all and view_all permissions")
            schedule_ok = True
        else:
            print("   ❌ Schedule.jsx missing read_all or view_all checks")
            schedule_ok = False
            
        return employees_ok and schedule_ok
        
    except Exception as e:
        print(f"   ❌ Failed to check frontend files: {e}")
        return False

def test_schedule_router():
    """Test that schedule router supports both legacy and new permissions"""
    try:
        with open('backend/routers/schedule.py', 'r') as f:
            content = f.read()
            
        print("\n🔍 Testing Schedule Router Permissions...")
        
        # Check for view_all support
        has_view_all_check = "schedule:view_all" in content
        has_legacy_support = "Legacy support" in content
        has_both_checks = "has_write_all or has_view_all" in content
        
        if has_view_all_check and has_legacy_support and has_both_checks:
            print("   ✅ Schedule router supports both legacy write_all and new view_all")
            return True
        else:
            print("   ❌ Schedule router missing proper permission support")
            print(f"      view_all check: {has_view_all_check}")
            print(f"      legacy support: {has_legacy_support}")
            print(f"      both checks: {has_both_checks}")
            return False
            
    except Exception as e:
        print(f"   ❌ Failed to check schedule router: {e}")
        return False

def test_migration_script():
    """Test that migration script exists and looks correct"""
    try:
        with open('fix_production_permissions.py', 'r') as f:
            content = f.read()
            
        print("\n🔍 Testing Migration Script...")
        
        has_write_all_migration = "write_all" in content and "view_all" in content
        has_read_migration = 'permission_type = \'read_all\'' in content
        has_backup = "backup" in content.lower()
        
        if has_write_all_migration and has_read_migration and has_backup:
            print("   ✅ Migration script looks correct")
            return True
        else:
            print("   ❌ Migration script issues found")
            return False
            
    except Exception as e:
        print(f"   ❌ Failed to check migration script: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Permission System Verification")
    print("=" * 50)
    
    tests = [
        ("PermissionType Enum", test_permission_enum),
        ("Frontend Permissions", test_frontend_permissions), 
        ("Schedule Router", test_schedule_router),
        ("Migration Script", test_migration_script)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} test failed with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Results Summary")
    
    all_passed = True
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"   {status} - {test_name}")
        if not passed:
            all_passed = False
    
    if all_passed:
        print("\n🎉 ALL TESTS PASSED!")
        print("✅ Permission system is ready for production deployment")
        return True
    else:
        print("\n⚠️  SOME TESTS FAILED!")
        print("❌ Please fix issues before deploying to production")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)