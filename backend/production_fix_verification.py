"""
Production Fix Verification

This script verifies that the frontend API URL fix has been deployed
and is working correctly.
"""

import requests
import time
from datetime import datetime

def wait_for_deployment():
    """Wait for Render deployment to complete"""
    print("⏳ WAITING FOR RENDER DEPLOYMENT")
    print("=" * 50)
    print("Render typically takes 2-5 minutes to rebuild and deploy...")
    
    for i in range(10):
        print(f"Checking deployment status... ({i+1}/10)")
        
        try:
            # Check if frontend is serving new version
            response = requests.get("https://lavishbeautyhairandnail.care", timeout=10)
            
            # Look for signs of new build (could check build timestamp, etc.)
            if response.status_code == 200:
                print(f"✅ Frontend responding (attempt {i+1})")
            else:
                print(f"⚠️  Frontend status {response.status_code}")
                
        except Exception as e:
            print(f"❌ Frontend not responding: {e}")
        
        if i < 9:  # Don't wait after last attempt
            time.sleep(30)  # Wait 30 seconds between checks
    
    print("Proceeding with verification...")

def verify_api_fix():
    """Verify that the API URL fix is working"""
    print(f"\n🔍 VERIFYING API FIX")
    print("=" * 50)
    print(f"Timestamp: {datetime.now()}")
    
    # Test the frontend API route that was failing before
    test_url = "https://lavishbeautyhairandnail.care/api/v1/auth/me"
    
    try:
        response = requests.get(test_url, timeout=15)
        
        print(f"URL: {test_url}")
        print(f"Status: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type', 'unknown')}")
        
        if response.text.strip().startswith('<!'):
            print("❌ STILL GETTING HTML - Fix not deployed yet or didn't work")
            print(f"Response: {response.text[:200]}...")
            return False
        elif 'application/json' in response.headers.get('content-type', ''):
            print("✅ SUCCESS! Now getting JSON responses!")
            try:
                json_data = response.json()
                print(f"JSON Response: {json_data}")
                return True
            except:
                print("✅ Getting JSON content-type but couldn't parse - still an improvement!")
                return True
        else:
            print(f"⚠️  Getting different content type: {response.headers.get('content-type')}")
            print(f"Response: {response.text[:200]}...")
            return False
            
    except Exception as e:
        print(f"❌ Request failed: {e}")
        return False

def test_login_flow():
    """Test the actual login flow that was failing"""
    print(f"\n🔐 TESTING LOGIN FLOW")
    print("=" * 30)
    
    login_url = "https://lavishbeautyhairandnail.care/api/v1/auth/login"
    
    # Test with invalid credentials (should return JSON error)
    test_data = {
        "username": "test",
        "password": "test"
    }
    
    try:
        response = requests.post(login_url, json=test_data, timeout=15)
        
        print(f"Login URL: {login_url}")
        print(f"Status: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type', 'unknown')}")
        
        if 'application/json' in response.headers.get('content-type', ''):
            try:
                error_data = response.json()
                print("✅ LOGIN ENDPOINT WORKING! Getting JSON error response")
                print(f"Response: {error_data}")
                return True
            except:
                print("✅ JSON content-type returned")
                return True
        else:
            print("❌ Login still returning HTML instead of JSON")
            print(f"Response: {response.text[:200]}...")
            return False
            
    except Exception as e:
        print(f"❌ Login test failed: {e}")
        return False

def main():
    """Run complete verification"""
    print("🚀 PRODUCTION FIX VERIFICATION")
    print("=" * 60)
    
    # Wait a bit for deployment
    wait_for_deployment()
    
    # Test the fix
    api_fixed = verify_api_fix()
    login_working = test_login_flow()
    
    print(f"\n" + "=" * 60)
    print("📊 VERIFICATION RESULTS")
    print("=" * 60)
    
    if api_fixed and login_working:
        print("🎉 SUCCESS! The API URL fix is working!")
        print("\n✅ What's now working:")
        print("   • Frontend API calls return JSON instead of HTML")
        print("   • Login endpoint works correctly")
        print("   • The 'Unexpected token <' error should be resolved")
        
        print(f"\n🎯 Next steps:")
        print("   • Try logging in on https://lavishbeautyhairandnail.care")
        print("   • Test the WRITE_ALL permissions feature")
        print("   • Navigate to Employees → Permissions")
        
    elif api_fixed or login_working:
        print("⚠️  PARTIAL SUCCESS - Some endpoints working")
        print("   • Wait a few more minutes for full deployment")
        print("   • Try refreshing the website")
        
    else:
        print("❌ Fix not yet deployed or needs additional changes")
        print("   • Check Render deployment logs")
        print("   • Verify build completed successfully")
    
    print(f"\nVerification completed: {datetime.now()}")

if __name__ == "__main__":
    main()