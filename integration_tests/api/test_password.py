"""
Password change integration test.

Tests the full flow: create user → login → wrong current password rejected →
correct change → old password fails → new password works.
"""

import requests
from conftest import BASE_URL


def test_client_password_change(admin_session, create_user):
    """User changes their own password; old password stops working, new one works."""
    username, init_pw, _ = create_user("pw_change_user", password="initial_password")
    new_pw = "updated_password"

    # Login with initial password
    login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": username,
        "password": init_pw,
    })
    assert login_res.status_code == 200
    user_cookies = login_res.cookies

    # Wrong current password → 401
    res = requests.put(f"{BASE_URL}/api/auth/password", json={
        "current_password": "wrong_password",
        "new_password": new_pw,
    }, cookies=user_cookies)
    assert res.status_code == 401

    # Correct current password → 200
    res = requests.put(f"{BASE_URL}/api/auth/password", json={
        "current_password": init_pw,
        "new_password": new_pw,
    }, cookies=user_cookies)
    assert res.status_code == 200

    # Old password no longer works
    res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": username,
        "password": init_pw,
    })
    assert res.status_code == 401

    # New password works
    res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": username,
        "password": new_pw,
    })
    assert res.status_code == 200
