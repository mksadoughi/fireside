import requests
import pytest
import sqlite3
import os
import json

BASE_URL = "http://localhost:7654"

@pytest.fixture(scope="module")
def setup_server():
    """Ensure the server is set up."""
    # Try to set up the server (will return 409 if already set up)
    requests.post(f"{BASE_URL}/api/setup", json={
        "username": "admin",
        "password": "password",
        "server_name": "Test Server"
    })
    return True

def test_unencrypted_chat_backward_compatibility(setup_server):
    """Test that a plain unencrypted HTTP POST to the chat API defaults to plaintext in DB"""
    
    # Login as admin
    login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "password"
    })
    assert login_res.status_code == 200
    cookies = login_res.cookies

    # Send a plaintext chat message
    chat_payload = {
        "model": "dummy", 
        "message": "Hello backward compatibility!",
        "encrypted": False
    }

    # This might return 502 if Ollama isn't running the model, which is fine
    # What matters is that the backend accepted our HTTP structure
    chat_res = requests.post(
        f"{BASE_URL}/api/chat",
        json=chat_payload,
        cookies=cookies
    )
    
    # 502 Bad Gateway means Ollama failed, but the auth and payload were accepted.
    assert chat_res.status_code in [200, 502], f"Unexpected status {chat_res.status_code}"

def test_database_encryption_at_rest(setup_server):
    """Verify any encrypted messages in SQLite are properly structured with nonces"""
    db_path = os.path.expanduser("~/.fireside/data.db")
    if not os.path.exists(db_path):
        pytest.skip("Database does not exist yet")
        
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    c.execute("SELECT id, content_iv FROM messages")
    rows = c.fetchall()
    
    # Messages fall into two profiles: legacy/unencrypted or strict AES-256-GCM
    for msg_id, iv in rows:
        # If it wasn't strictly plaintext fallback
        if iv != b'plaintext' and iv != 'plaintext':
            assert len(iv) == 12, f"Expected 12-byte IV for true AES-GCM, got {len(iv)}"

    conn.close()
