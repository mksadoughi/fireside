"""
Auth flow integration tests.

Tests:
  - Invite → register → verify user exists → revoke → verify gone
  - Login rate limiting (6 wrong passwords → 429)
"""

import requests
from conftest import BASE_URL


def test_user_creation_and_revocation(admin_session, create_user):
    """Create a user via invite, verify they appear in admin list, revoke, verify gone."""
    _, _, user_id = create_user("testuser_revoke")

    # Verify user exists in admin list
    res = requests.get(f"{BASE_URL}/api/admin/users", cookies=admin_session)
    users = res.json().get("users", [])
    assert any(u["id"] == user_id for u in users), "User should exist"

    # Revoke
    res = requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", cookies=admin_session)
    assert res.status_code == 200

    # Verify gone
    res = requests.get(f"{BASE_URL}/api/admin/users", cookies=admin_session)
    users = res.json().get("users", [])
    assert not any(u["id"] == user_id for u in users), "User should be gone"


def test_login_rate_limiting():
    """6 wrong passwords from the same IP triggers 429 Too Many Requests."""
    headers = {"X-Forwarded-For": "10.99.99.99"}
    for _ in range(6):
        requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "wrongpassword",
        }, headers=headers)

    res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "wrongpassword",
    }, headers=headers)
    assert res.status_code == 429, f"Expected 429, got {res.status_code}"
