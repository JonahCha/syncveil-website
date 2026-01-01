#!/usr/bin/env python3
"""
Backend Health Check Script
Tests all critical backend functionality
"""

import os
import sys
import requests
import json
from datetime import datetime

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

# Configuration
BASE_URL = os.getenv('BACKEND_URL', 'http://localhost:8000')
TEST_EMAIL = f'test_{datetime.now().timestamp()}@example.com'
TEST_PASSWORD = 'TestPassword123!'

def print_test(name, status, message=''):
    """Print formatted test result"""
    status_icon = f"{GREEN}✓{RESET}" if status else f"{RED}✗{RESET}"
    print(f"{status_icon} {name}")
    if message:
        print(f"  {YELLOW}{message}{RESET}")

def check_env_file():
    """Check if .env file exists and is configured"""
    print(f"\n{BLUE}=== Checking Environment Configuration ==={RESET}")
    
    env_path = '/workspaces/syncveil-website/.env'
    example_path = '/workspaces/syncveil-website/.env.example'
    
    if os.path.exists(env_path):
        print_test("Environment file exists", True, f"Found: {env_path}")
        
        # Check critical variables
        with open(env_path, 'r') as f:
            content = f.read()
            has_db = 'DATABASE_URL' in content
            has_jwt = 'JWT_SECRET' in content
            has_cors = 'CORS_ORIGINS' in content
            
            print_test("DATABASE_URL configured", has_db)
            print_test("JWT_SECRET configured", has_jwt)
            print_test("CORS_ORIGINS configured", has_cors)
            
            return has_db and has_jwt and has_cors
    else:
        print_test("Environment file exists", False, f"Copy {example_path} to {env_path}")
        return False

def check_backend_running():
    """Check if backend server is running"""
    print(f"\n{BLUE}=== Checking Backend Server ==={RESET}")
    
    try:
        response = requests.get(f"{BASE_URL}/", timeout=5)
        print_test("Backend server is running", True, f"URL: {BASE_URL}")
        print_test("Root endpoint responds", response.status_code == 200)
        return True
    except requests.exceptions.ConnectionError:
        print_test("Backend server is running", False, 
                  f"Cannot connect to {BASE_URL}. Is the server running?")
        return False
    except Exception as e:
        print_test("Backend server is running", False, str(e))
        return False

def check_health_endpoint():
    """Check /health endpoint"""
    print(f"\n{BLUE}=== Checking Health Endpoint ==={RESET}")
    
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        print_test("Health endpoint responds", response.status_code == 200)
        
        if response.status_code == 200:
            data = response.json()
            print(f"  {json.dumps(data, indent=2)}")
            return True
        return False
    except Exception as e:
        print_test("Health endpoint responds", False, str(e))
        return False

def check_cors():
    """Check CORS configuration"""
    print(f"\n{BLUE}=== Checking CORS Configuration ==={RESET}")
    
    try:
        headers = {
            'Origin': 'http://localhost:3000',
            'Access-Control-Request-Method': 'POST'
        }
        response = requests.options(f"{BASE_URL}/auth/register", headers=headers, timeout=5)
        
        has_cors = 'access-control-allow-origin' in response.headers
        print_test("CORS headers present", has_cors)
        
        if has_cors:
            print(f"  Access-Control-Allow-Origin: {response.headers.get('access-control-allow-origin')}")
        return has_cors
    except Exception as e:
        print_test("CORS headers present", False, str(e))
        return False

def check_database():
    """Check database connectivity"""
    print(f"\n{BLUE}=== Checking Database ==={RESET}")
    
    db_path = '/workspaces/syncveil-website/syncveil.db'
    
    if os.path.exists(db_path):
        print_test("Database file exists", True, f"Found: {db_path}")
        size = os.path.getsize(db_path)
        print(f"  Size: {size} bytes")
        return True
    else:
        print_test("Database file exists", False, 
                  "Database not initialized. Run backend to create it.")
        return False

def test_register_endpoint():
    """Test user registration"""
    print(f"\n{BLUE}=== Testing Registration Endpoint ==={RESET}")
    
    try:
        payload = {
            'email': TEST_EMAIL,
            'password': TEST_PASSWORD,
            'username': f'testuser_{int(datetime.now().timestamp())}'
        }
        
        response = requests.post(f"{BASE_URL}/auth/register", json=payload, timeout=10)
        print_test("Registration endpoint responds", True)
        print_test("Registration successful", response.status_code in [200, 201])
        
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"  Response: {json.dumps(data, indent=2)}")
            return data
        else:
            print(f"  Status: {response.status_code}")
            print(f"  Response: {response.text}")
            return None
    except Exception as e:
        print_test("Registration endpoint responds", False, str(e))
        return None

def test_login_endpoint(email=None):
    """Test user login"""
    print(f"\n{BLUE}=== Testing Login Endpoint ==={RESET}")
    
    try:
        payload = {
            'email': email or TEST_EMAIL,
            'password': TEST_PASSWORD
        }
        
        response = requests.post(f"{BASE_URL}/auth/login", json=payload, timeout=10)
        print_test("Login endpoint responds", True)
        print_test("Login successful", response.status_code == 200)
        
        if response.status_code == 200:
            data = response.json()
            has_token = 'access_token' in data
            print_test("Access token returned", has_token)
            
            if has_token:
                print(f"  Token type: {data.get('token_type')}")
                return data['access_token']
        else:
            print(f"  Status: {response.status_code}")
            print(f"  Response: {response.text}")
        return None
    except Exception as e:
        print_test("Login endpoint responds", False, str(e))
        return None

def test_protected_endpoint(token):
    """Test protected endpoint with token"""
    print(f"\n{BLUE}=== Testing Protected Endpoints ==={RESET}")
    
    try:
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.get(f"{BASE_URL}/users/me", headers=headers, timeout=10)
        
        print_test("Protected endpoint responds", True)
        print_test("Authentication works", response.status_code == 200)
        
        if response.status_code == 200:
            data = response.json()
            print(f"  User data: {json.dumps(data, indent=2)}")
            return True
        else:
            print(f"  Status: {response.status_code}")
            print(f"  Response: {response.text}")
        return False
    except Exception as e:
        print_test("Protected endpoint responds", False, str(e))
        return False

def main():
    """Run all backend tests"""
    print(f"\n{BLUE}{'='*50}{RESET}")
    print(f"{BLUE}  SyncVeil Backend Health Check{RESET}")
    print(f"{BLUE}{'='*50}{RESET}")
    
    results = []
    
    # Basic checks
    results.append(('Environment', check_env_file()))
    results.append(('Server Running', check_backend_running()))
    
    if not results[-1][1]:
        print(f"\n{RED}Backend server is not running. Please start it first:{RESET}")
        print(f"{YELLOW}  cd /workspaces/syncveil-website{RESET}")
        print(f"{YELLOW}  python -m uvicorn main:app --reload{RESET}")
        sys.exit(1)
    
    results.append(('Health Check', check_health_endpoint()))
    results.append(('CORS', check_cors()))
    results.append(('Database', check_database()))
    
    # Functional tests
    user_data = test_register_endpoint()
    if user_data:
        email = user_data.get('email', TEST_EMAIL)
        token = test_login_endpoint(email)
        
        if token:
            results.append(('Authentication Flow', True))
            results.append(('Protected Endpoints', test_protected_endpoint(token)))
        else:
            results.append(('Authentication Flow', False))
    
    # Summary
    print(f"\n{BLUE}{'='*50}{RESET}")
    print(f"{BLUE}  Test Summary{RESET}")
    print(f"{BLUE}{'='*50}{RESET}")
    
    passed = sum(1 for _, status in results if status)
    total = len(results)
    
    for name, status in results:
        status_text = f"{GREEN}PASS{RESET}" if status else f"{RED}FAIL{RESET}"
        print(f"  {name}: {status_text}")
    
    print(f"\n{BLUE}Total: {passed}/{total} tests passed{RESET}")
    
    if passed == total:
        print(f"\n{GREEN}✓ All tests passed! Backend is working correctly.{RESET}")
        return 0
    else:
        print(f"\n{YELLOW}⚠ Some tests failed. Check the output above for details.{RESET}")
        return 1

if __name__ == '__main__':
    sys.exit(main())
