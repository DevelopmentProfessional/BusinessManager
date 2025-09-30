"""
Production API Error Diagnostics

This script helps diagnose why you're getting HTML instead of JSON
by testing the specific API calls that are failing.
"""

import requests
import json
from datetime import datetime

def test_specific_api_calls():
    """Test the specific API calls that are returning HTML"""
    print("🚀 PRODUCTION API ERROR DIAGNOSTICS")
    print("=" * 60)
    print(f"Timestamp: {datetime.now()}")
    
    base_url = "https://lavish-beauty-api.onrender.com/api/v1"
    
    # Common API calls that might be failing
    test_endpoints = [
        ("Health Check", "GET", "https://lavish-beauty-api.onrender.com/health", None),
        ("Login", "POST", f"{base_url}/auth/login", {"username": "test", "password": "test"}),
        ("Auth Me", "GET", f"{base_url}/auth/me", None),
        ("Employees", "GET", f"{base_url}/employees", None),
        ("Schedule", "GET", f"{base_url}/schedule", None),
        ("Clients", "GET", f"{base_url}/clients", None),
    ]
    
    results = {}
    
    for name, method, url, data in test_endpoints:
        print(f"\n🔍 Testing {name}")
        print(f"URL: {url}")
        
        try:
            if method == "GET":
                response = requests.get(url, timeout=15)
            else:
                response = requests.post(url, json=data, timeout=15)
            
            print(f"Status: {response.status_code}")
            content_type = response.headers.get('content-type', 'unknown')
            print(f"Content-Type: {content_type}")
            
            # Check if we're getting HTML instead of JSON
            response_text = response.text[:200]
            
            if response_text.strip().startswith('<!'):
                print("❌ RECEIVING HTML INSTEAD OF JSON!")
                print(f"Response preview: {response_text}...")
                results[name] = 'html_error'
                
                # Try to identify what HTML page we're getting
                if 'render.com' in response_text.lower():
                    print("   → This looks like a Render error page")
                elif 'application error' in response_text.lower():
                    print("   → This looks like an application error page")
                elif 'not found' in response_text.lower():
                    print("   → This looks like a 404 page")
                else:
                    print("   → Unknown HTML response")
                    
            elif 'application/json' in content_type:
                try:
                    json_data = response.json()
                    print("✅ Receiving valid JSON")
                    print(f"Response: {json_data}")
                    results[name] = 'json_ok'
                except json.JSONDecodeError:
                    print("❌ Claims to be JSON but invalid")
                    print(f"Response: {response_text}...")
                    results[name] = 'json_invalid'
            else:
                print(f"⚠️  Unexpected content type: {content_type}")
                print(f"Response: {response_text}...")
                results[name] = 'unexpected'
                
        except requests.exceptions.Timeout:
            print("❌ Request timed out")
            results[name] = 'timeout'
        except requests.exceptions.ConnectionError:
            print("❌ Connection failed")
            results[name] = 'connection_error'
        except Exception as e:
            print(f"❌ Error: {e}")
            results[name] = 'error'
    
    return results

def check_render_service_status():
    """Check if the Render services are actually running"""
    print("\n🔍 CHECKING RENDER SERVICE STATUS")
    print("=" * 40)
    
    services = [
        ("Backend", "https://lavish-beauty-api.onrender.com/health"),
        ("Frontend", "https://lavishbeautyhairandnail.care"),
    ]
    
    for name, url in services:
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                print(f"✅ {name} service is responding")
            else:
                print(f"⚠️  {name} service returned {response.status_code}")
        except Exception as e:
            print(f"❌ {name} service is not accessible: {e}")

def diagnose_html_responses(results):
    """Analyze the results to determine the cause"""
    print("\n🔍 DIAGNOSIS")
    print("=" * 40)
    
    html_errors = [name for name, result in results.items() if result == 'html_error']
    json_ok = [name for name, result in results.items() if result == 'json_ok']
    
    if html_errors and not json_ok:
        print("❌ ALL API CALLS RETURNING HTML - Service is down or misconfigured")
        print("\nPossible causes:")
        print("• Backend service failed to start")
        print("• Database connection preventing startup")
        print("• Environment variables missing")
        print("• Application crash during initialization")
        
    elif html_errors and json_ok:
        print("⚠️  SOME API CALLS RETURNING HTML - Partial service failure")
        print(f"\nWorking endpoints: {json_ok}")
        print(f"Failing endpoints: {html_errors}")
        print("\nPossible causes:")
        print("• Database-dependent endpoints failing")
        print("• Authentication/permission issues")
        print("• Specific route configuration problems")
        
    elif json_ok and not html_errors:
        print("✅ ALL API CALLS WORKING - Issue might be intermittent")
        print("\nPossible causes:")
        print("• Frontend caching old responses")
        print("• Timing issues with database connections")
        print("• Load balancer or CDN issues")
        
    else:
        print("⚠️  MIXED RESULTS - Need more investigation")

def main():
    """Run the diagnostics"""
    results = test_specific_api_calls()
    check_render_service_status()
    diagnose_html_responses(results)
    
    print("\n" + "=" * 60)
    print("📋 NEXT STEPS")
    print("=" * 60)
    
    html_count = sum(1 for r in results.values() if r == 'html_error')
    
    if html_count > 0:
        print("🔧 IMMEDIATE ACTIONS:")
        print("1. Check Render dashboard for service logs")
        print("2. Verify DATABASE_URL environment variable")
        print("3. Check if backend service is actually running")
        print("4. Look for application startup errors")
        print("\n📱 Commands to run:")
        print("• Check Render logs: https://dashboard.render.com")
        print("• Test database: Run production_db_diagnostics.py with DATABASE_URL")
    else:
        print("✅ API seems healthy - issue might be frontend-specific")
        print("• Try hard refresh (Ctrl+F5) on frontend")
        print("• Check browser network tab for actual requests")

if __name__ == "__main__":
    main()