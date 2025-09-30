"""
Deep Production Investigation

Since the error occurs even in private browsing, this script will investigate
what's actually happening when the frontend tries to make API calls.
"""

import requests
import json
from datetime import datetime

def deep_production_investigation():
    """Deep dive into production API behavior"""
    print("🔍 DEEP PRODUCTION INVESTIGATION")
    print("=" * 60)
    print(f"Timestamp: {datetime.now()}")
    
    # Test the exact URL the frontend is calling
    frontend_api_url = "https://lavishbeautyhairandnail.care/api/v1/auth/me"
    backend_api_url = "https://lavish-beauty-api.onrender.com/api/v1/auth/me"
    
    print("\n1️⃣ TESTING FRONTEND ROUTE (What browser calls)")
    print(f"URL: {frontend_api_url}")
    
    try:
        response = requests.get(frontend_api_url, timeout=10, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        print(f"Status: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type', 'unknown')}")
        print(f"Response preview: {response.text[:300]}...")
        
        if response.text.strip().startswith('<!'):
            print("❌ FRONTEND IS SERVING HTML INSTEAD OF PROXYING TO API!")
            print("This means the frontend doesn't have proper API proxy configuration")
        
    except Exception as e:
        print(f"❌ Frontend route error: {e}")
    
    print(f"\n2️⃣ TESTING DIRECT BACKEND (What should work)")
    print(f"URL: {backend_api_url}")
    
    try:
        response = requests.get(backend_api_url, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type', 'unknown')}")
        print(f"Response: {response.json()}")
        
    except Exception as e:
        print(f"❌ Backend error: {e}")
    
    print(f"\n3️⃣ TESTING FRONTEND ROOT")
    try:
        response = requests.get("https://lavishbeautyhairandnail.care", timeout=10)
        print(f"Frontend root status: {response.status_code}")
        
        # Check if the frontend is configured to handle /api routes
        if '/api' in response.text:
            print("✅ Frontend mentions /api in its code")
        else:
            print("❌ Frontend may not be configured to handle /api routes")
            
    except Exception as e:
        print(f"❌ Frontend root error: {e}")
    
    print(f"\n4️⃣ DIAGNOSIS")
    print("=" * 40)
    print("The issue is likely one of these:")
    print("1. Frontend build doesn't include Vite proxy configuration")
    print("2. Production frontend isn't routing /api calls correctly")
    print("3. Frontend is hardcoded to wrong API URL")
    print("4. CORS issues preventing frontend from calling backend")
    
    print(f"\n🔧 NEXT STEPS:")
    print("• Check frontend build configuration")
    print("• Verify VITE_API_URL is being used correctly")
    print("• Check if frontend has service worker interfering")
    print("• Test direct backend URLs in browser")

def test_cors_and_direct_access():
    """Test CORS and direct backend access"""
    print(f"\n🌐 CORS AND DIRECT ACCESS TEST")
    print("=" * 40)
    
    # Test CORS headers
    try:
        response = requests.options("https://lavish-beauty-api.onrender.com/api/v1/auth/me", 
                                  headers={
                                      'Origin': 'https://lavishbeautyhairandnail.care',
                                      'Access-Control-Request-Method': 'GET'
                                  })
        
        cors_headers = {k: v for k, v in response.headers.items() if 'access-control' in k.lower()}
        
        if cors_headers:
            print("✅ CORS headers present:")
            for header, value in cors_headers.items():
                print(f"   {header}: {value}")
        else:
            print("❌ No CORS headers found - this might be the issue!")
            
    except Exception as e:
        print(f"❌ CORS test failed: {e}")
    
    print(f"\n📋 RECOMMENDED BROWSER TESTS:")
    print("1. Open browser dev tools (F12)")
    print("2. Go to Network tab")
    print("3. Visit https://lavishbeautyhairandnail.care")
    print("4. Try to log in")
    print("5. Look for failed API calls in Network tab")
    print("6. Check if calls go to /api/v1/* or direct backend URL")

if __name__ == "__main__":
    deep_production_investigation()
    test_cors_and_direct_access()