"""
Shared fixtures for Fireside integration tests.

Configure via environment variables:
    FIRESIDE_URL      Base URL of the server (default: http://localhost:7654)
    FIRESIDE_ADMIN    Admin username (default: admin)
    FIRESIDE_PASSWORD Admin password (default: password)
    FIRESIDE_API_KEY  API key for OpenAI-compatible endpoints (required for test_langchain)
    FIRESIDE_MODEL    Model name to use for LLM tests (default: llama3.2:1b)
"""

import os
import requests
import pytest

BASE_URL = os.environ.get("FIRESIDE_URL", "http://localhost:7654")
ADMIN_USER = os.environ.get("FIRESIDE_ADMIN", "admin")
ADMIN_PASS = os.environ.get("FIRESIDE_PASSWORD", "password")
API_KEY = os.environ.get("FIRESIDE_API_KEY", "")
MODEL = os.environ.get("FIRESIDE_MODEL", "llama3.2:1b")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def admin_session():
    """Set up the server (if needed) and return an admin session cookie jar."""
    # Attempt setup — will 409 if already done, which is fine
    requests.post(f"{BASE_URL}/api/setup", json={
        "server_name": "Test Server",
        "username": ADMIN_USER,
        "password": ADMIN_PASS,
    })

    res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": ADMIN_USER,
        "password": ADMIN_PASS,
    })
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    return res.cookies


@pytest.fixture
def create_user(admin_session):
    """Factory fixture: creates an invited user and returns (username, password, user_id).
    Automatically cleans up (deletes the user) after the test."""
    created = []

    def _create(username, password="password123"):
        # Create invite
        res = requests.post(
            f"{BASE_URL}/api/admin/invites", json={}, cookies=admin_session
        )
        assert res.status_code == 201
        token = res.json()["invite"]["token"]

        # Register
        res = requests.post(f"{BASE_URL}/api/auth/register", json={
            "token": token,
            "username": username,
            "password": password,
        })
        assert res.status_code == 201, f"Register failed: {res.text}"
        user_id = res.json()["user"]["id"]
        created.append(user_id)
        return username, password, user_id

    yield _create

    # Cleanup: delete all users created during the test
    for uid in created:
        requests.delete(f"{BASE_URL}/api/admin/users/{uid}", cookies=admin_session)
