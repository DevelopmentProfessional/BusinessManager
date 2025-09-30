"""
Production Database Connection Tester

This script tests the production PostgreSQL database connection directly
using the external database URL to diagnose potential database issues
that could cause API endpoints to return HTML instead of JSON.
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import psycopg2
from datetime import datetime

# Production database URL (you'll need to set this)
PROD_DB_URL = os.getenv('DATABASE_URL') or input("Enter production DATABASE_URL: ")

def test_direct_postgres_connection():
    """Test direct PostgreSQL connection without SQLAlchemy"""
    print("🔍 TESTING DIRECT POSTGRESQL CONNECTION")
    print("=" * 50)
    
    try:
        # Parse the database URL
        if not PROD_DB_URL.startswith('postgresql://'):
            print("❌ Invalid database URL format")
            return False
            
        # Direct psycopg2 connection
        conn = psycopg2.connect(PROD_DB_URL)
        cursor = conn.cursor()
        
        # Test basic connection
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]
        print(f"✅ PostgreSQL Connected: {version[:50]}...")
        
        # Test database exists and has tables
        cursor.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """)
        tables = cursor.fetchall()
        print(f"✅ Found {len(tables)} tables: {[t[0] for t in tables[:5]]}")
        
        # Test user table specifically
        cursor.execute("SELECT COUNT(*) FROM users;")
        user_count = cursor.fetchone()[0]
        print(f"✅ Users table has {user_count} records")
        
        # Test user table structure
        cursor.execute("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            ORDER BY ordinal_position;
        """)
        columns = cursor.fetchall()
        print(f"✅ User table has {len(columns)} columns")
        for col_name, col_type, nullable in columns[:10]:  # Show first 10
            print(f"   - {col_name}: {col_type} ({'NULL' if nullable == 'YES' else 'NOT NULL'})")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Direct PostgreSQL connection failed: {e}")
        return False

def test_sqlalchemy_connection():
    """Test SQLAlchemy connection (what the app uses)"""
    print("\n🔍 TESTING SQLALCHEMY CONNECTION")
    print("=" * 50)
    
    try:
        # Create engine like the app does
        engine = create_engine(PROD_DB_URL, echo=False)
        
        # Test connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) as count FROM users"))
            user_count = result.fetchone()[0]
            print(f"✅ SQLAlchemy connection successful")
            print(f"✅ Users count via SQLAlchemy: {user_count}")
            
        # Test session maker (like app uses)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        session = SessionLocal()
        
        result = session.execute(text("SELECT username FROM users LIMIT 3"))
        users = result.fetchall()
        print(f"✅ Sample users: {[u[0] for u in users]}")
        
        session.close()
        return True
        
    except Exception as e:
        print(f"❌ SQLAlchemy connection failed: {e}")
        return False

def test_environment_simulation():
    """Simulate the production environment"""
    print("\n🔍 TESTING PRODUCTION ENVIRONMENT SIMULATION")
    print("=" * 50)
    
    try:
        # Set environment like production
        os.environ['DATABASE_URL'] = PROD_DB_URL
        os.environ['ENVIRONMENT'] = 'production'
        
        # Import models like the app does
        sys.path.append('backend')
        
        from database import get_session, engine
        from models import User
        
        # Test the actual database setup the app uses
        session = next(get_session())
        
        # Query users like the health check does
        user_count = session.query(User).count()
        print(f"✅ Production simulation successful")
        print(f"✅ Users via app models: {user_count}")
        
        # Test a sample user query
        users = session.query(User).limit(3).all()
        print(f"✅ Sample user IDs: {[u.id for u in users]}")
        
        session.close()
        return True
        
    except Exception as e:
        print(f"❌ Production simulation failed: {e}")
        return False

def diagnose_api_error():
    """Try to diagnose what might cause HTML responses"""
    print("\n🔍 DIAGNOSING POTENTIAL API ISSUES")
    print("=" * 50)
    
    issues = []
    
    # Check database URL format
    if not PROD_DB_URL or not PROD_DB_URL.startswith('postgresql://'):
        issues.append("❌ Invalid or missing DATABASE_URL")
    else:
        print("✅ Database URL format looks correct")
    
    # Check if database is accessible
    try:
        engine = create_engine(PROD_DB_URL)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✅ Database is accessible")
    except Exception as e:
        issues.append(f"❌ Database connection issue: {str(e)[:100]}...")
    
    # Check for missing tables/columns
    try:
        engine = create_engine(PROD_DB_URL)
        with engine.connect() as conn:
            # Check if users table has all required columns
            result = conn.execute(text("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'users'
            """))
            columns = [row[0] for row in result]
            
            required_columns = ['id', 'username', 'email', 'hashed_password', 'is_active', 'is_admin']
            missing = [col for col in required_columns if col not in columns]
            
            if missing:
                issues.append(f"❌ Missing required columns: {missing}")
            else:
                print("✅ All required user columns present")
                
    except Exception as e:
        issues.append(f"❌ Table structure check failed: {str(e)[:100]}...")
    
    return issues

def main():
    """Run comprehensive production database diagnostics"""
    print("🚀 PRODUCTION DATABASE DIAGNOSTICS")
    print("=" * 60)
    print(f"Timestamp: {datetime.now()}")
    print(f"Testing database: {PROD_DB_URL[:50]}...")
    
    # Run all tests
    tests = [
        test_direct_postgres_connection,
        test_sqlalchemy_connection,
        test_environment_simulation
    ]
    
    results = {}
    for test in tests:
        try:
            results[test.__name__] = test()
        except Exception as e:
            print(f"❌ Test {test.__name__} crashed: {e}")
            results[test.__name__] = False
    
    # Diagnose issues
    issues = diagnose_api_error()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 DIAGNOSTIC SUMMARY")
    print("=" * 60)
    
    if all(results.values()) and not issues:
        print("🎉 DATABASE CONNECTION IS HEALTHY!")
        print("The HTML error is likely not database-related.")
        print("\nPossible causes:")
        print("• Frontend caching old responses")
        print("• Render deployment still in progress")
        print("• CORS or routing issues")
        print("• Environment variables not updated")
    else:
        print("⚠️  DATABASE ISSUES DETECTED:")
        for test_name, passed in results.items():
            status = "✅" if passed else "❌"
            print(f"   {test_name}: {status}")
        
        if issues:
            print("\n🔧 SPECIFIC ISSUES:")
            for issue in issues:
                print(f"   {issue}")
    
    print(f"\nDiagnostics completed: {datetime.now()}")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nDiagnostics cancelled by user")
    except Exception as e:
        print(f"\n❌ Diagnostics failed: {e}")
        sys.exit(1)