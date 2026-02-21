import requests
import pytest

BASE_URL = "http://localhost:7654"

@pytest.fixture(scope="module")
def setup_server():
    """Ensure the server is set up."""
    # Try to set up the server (will return 409 if already set up)
    requests.post(f"{BASE_URL}/api/setup", json={
        "server_name": "Test Server",
        "username": "admin",
        "password": "password"
    })

def test_client_password_change(setup_server):
    """Test creating a user, logging in, changing their password, and logging in with the new password"""
    
    # 1. Admin logs in to generate an invite
    admin_res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "password"
    })
    admin_cookies = admin_res.cookies
    
    # 2. Create Invite
    invite_res = requests.post(f"{BASE_URL}/api/admin/invites", json={}, cookies=admin_cookies)
    token = invite_res.json().get('invite', {}).get('token')
    
    # 3. Register New User
    username = "pw_change_user"
    init_pw = "initial_password"
    new_pw = "updated_password"
    
    reg_res = requests.post(f"{BASE_URL}/api/auth/register", json={
        "token": token,
        "username": username,
        "password": init_pw
    })
    
    # 4. User logs in with initial password
    login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": username,
        "password": init_pw
    })
    assert login_res.status_code == 200
    user_cookies = login_res.cookies
    
    # 5. User changes their own password
    pw_res = requests.put(f"{BASE_URL}/api/auth/password", json={
        "current_password": "wrong_password",
        "new_password": new_pw
    }, cookies=user_cookies)
    # This should fail because current password is wrong
    assert pw_res.status_code == 401
    
    pw_res2 = requests.put(f"{BASE_URL}/api/auth/password", json={
        "current_password": init_pw,
        "new_password": new_pw
    }, cookies=user_cookies)
    # This should succeed
    assert pw_res2.status_code == 200
    
    # 6. User logs out (just clear cookies)
    # 7. Try to log in with OLD password (should fail)
    fail_login = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": username,
        "password": init_pw
    })
    assert fail_login.status_code == 401
    
    # 8. Try to log in with NEW password (should succeed)
    success_login = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": username,
        "password": new_pw
    })
    assert success_login.status_code == 200
    
    # Cleanup: Admin revokes/deletes the user
    user_id = success_login.json().get('user').get('id')
    requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", cookies=admin_cookies)
