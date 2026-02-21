import requests
import pytest

BASE_URL = "http://localhost:7654"

@pytest.fixture(scope="session")
def setup_and_login():
    """Ensure the server is set up and return an admin session cookie"""
    # 1. Try to set up the server (will return 409 if already set up)
    requests.post(f"{BASE_URL}/api/setup", json={
        "server_name": "Test Server",
        "username": "admin",
        "password": "password"
    })
    
    # 2. Login to get the cookie
    res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "password"
    })
    assert res.status_code == 200, "Admin login failed"
    return res.cookies

def test_user_creation_and_revocation(setup_and_login):
    """Test generating an invite, registering a user, and then revoking them"""
    cookies = setup_and_login
    
    # 1. Create Invite
    res = requests.post(f"{BASE_URL}/api/admin/invites", json={}, cookies=cookies)
    assert res.status_code == 201
    token = res.json().get('invite', {}).get('token')
    assert token is not None
    
    # 2. Register New User
    res = requests.post(f"{BASE_URL}/api/auth/register", json={
        "token": token,
        "username": "testuser_revoke",
        "password": "password123"
    })
    assert res.status_code == 201
    user_id = res.json().get('user').get('id')
    assert user_id is not None
    
    # 3. Verify user exists in admin list
    res = requests.get(f"{BASE_URL}/api/admin/users", cookies=cookies)
    users = res.json().get('users', [])
    assert any(u['id'] == user_id for u in users), "User should be in the database"
    
    # 4. Revoke User
    res = requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", cookies=cookies)
    assert res.status_code == 200
    
    # 5. Verify user is gone
    res = requests.get(f"{BASE_URL}/api/admin/users", cookies=cookies)
    users = res.json().get('users', [])
    assert not any(u['id'] == user_id for u in users), "User should be removed from the database"

def test_login_rate_limiting():
    """Test that submitting wrong passwords triggers a 429 Too Many Requests error"""
    # Attempt 6 rapid failed logins
    headers = {"X-Forwarded-For": "2.2.2.2"}
    for _ in range(6):
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "wrongpassword"
        }, headers=headers)
        
    # The 6th or 7th attempt should be rate limited
    res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "wrongpassword"
    }, headers=headers)
    
    assert res.status_code == 429, "Expected status code 429 Too Many Requests"
