"""
Production API Endpoint Checker

This script helps verify that your API endpoints are working correctly
and helps debug the "Unexpected token '<'" error.
"""

import requests
import json
from datetime import datetime

def check_endpoint(url, description):
    """Check if an endpoint is responding correctly."""
    print(f"\n🔍 Testing {description}")
    print(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type', 'Not specified')}")
        
        # Show first 200 characters of response
        content_preview = response.text[:200]
        print(f"Response preview: {content_preview}...")
        
        if response.status_code == 200:
            if 'application/json' in response.headers.get('content-type', ''):
                try:
                    json_data = response.json()
                    print("✅ Valid JSON response received")
                    return True
                except json.JSONDecodeError:
                    print("❌ Response claims to be JSON but is invalid")
                    return False
            else:
                print("⚠️  Response is not JSON (this might be the problem)")
                return False
        else:
            print(f"❌ HTTP Error {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error - Cannot reach the server")
        return False
    except requests.exceptions.Timeout:
        print("❌ Timeout - Server is too slow to respond")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def main():
    """Test various API endpoints to diagnose the issue."""
    print("🚀 PRODUCTION API ENDPOINT DIAGNOSTICS")
    print("=" * 50)
    print(f"Timestamp: {datetime.now()}")
    
    # Test different possible API URLs
    endpoints_to_test = [
        ("https://api.lavishbeautyhairandnail.care/health", "Custom domain health check"),
        ("https://api.lavishbeautyhairandnail.care/api/v1/health", "Custom domain API health check"),
        ("https://lavish-beauty-api.onrender.com/health", "Render backend health check"), 
        ("https://lavish-beauty-api.onrender.com/api/v1/health", "Render backend API health check"),
        ("https://lavishbeautyhairandnail.care", "Frontend URL"),
        ("https://lavish-beauty-app.onrender.com", "Render frontend URL"),
    ]
    
    results = {}
    
    for url, description in endpoints_to_test:
        results[url] = check_endpoint(url, description)
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 SUMMARY")
    print("=" * 50)
    
    working_endpoints = [url for url, working in results.items() if working]
    failing_endpoints = [url for url, working in results.items() if not working]
    
    if working_endpoints:
        print("✅ Working endpoints:")
        for url in working_endpoints:
            print(f"   - {url}")
    
    if failing_endpoints:
        print("❌ Failing endpoints:")  
        for url in failing_endpoints:
            print(f"   - {url}")
    
    # Recommendations
    print("\n🔧 RECOMMENDATIONS:")
    
    if "https://lavish-beauty-api.onrender.com/health" in working_endpoints:
        print("✅ Backend is working - Update frontend VITE_API_URL to:")
        print("   https://lavish-beauty-api.onrender.com/api/v1")
    
    elif "https://api.lavishbeautyhairandnail.care/health" in working_endpoints:
        print("✅ Custom domain is working - Keep current frontend configuration")
        
    else:
        print("❌ No working API endpoints found - Check:")
        print("   1. Render deployment logs")
        print("   2. Backend service status")
        print("   3. DNS configuration")
    
    print(f"\n🕒 Check completed at {datetime.now()}")

if __name__ == "__main__":
    main()