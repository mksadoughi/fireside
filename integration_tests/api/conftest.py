import os
import time
import pytest
import sqlite3
import tempfile
import subprocess
import requests
import socket

def get_free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('localhost', 0))
    port = s.getsockname()[1]
    s.close()
    return port

@pytest.fixture(scope="session")
def server():
    """Starts the Fireside server with a temporary database."""
    port = get_free_port()
    
    # Create a temporary directory for the DB
    temp_dir = tempfile.mkdtemp()
    
    # Build the binary if it doesn't exist yet
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    binary_path = os.path.join(repo_root, "fireside")
    if not os.path.exists(binary_path):
        subprocess.run(["go", "build", "-o", "fireside", "./server"], cwd=repo_root, check=True)
    
    # Start the server
    env = os.environ.copy()
    env["FIRESIDE_DB_PATH"] = os.path.join(temp_dir, "data.db")
    env["FIRESIDE_PORT"] = str(port)
    env["FIRESIDE_NO_TUNNEL"] = "1"
    
    process = subprocess.Popen([binary_path, "-no-tunnel", "-port", str(port), "-data-dir", temp_dir], cwd=repo_root, env=env)
    
    # Wait for it to be ready
    base_url = f"http://localhost:{port}"
    for _ in range(50):
        try:
            res = requests.get(base_url, timeout=0.1)
            time.sleep(0.1)
            break
        except requests.exceptions.ConnectionError:
            time.sleep(0.1)
    else:
        process.kill()
        raise RuntimeError(f"Server at {base_url} never started.")
    
    # Return context
    yield {"base_url": base_url, "db_path": env["FIRESIDE_DB_PATH"]}
    
    # Shutdown
    process.terminate()
    process.wait(timeout=5)

@pytest.fixture(scope="session")
def setup_and_login(server):
    """Ensure the server is set up and return an admin session cookie"""
    base_url = server["base_url"]
    # 1. Try to set up the server (will return 409 if already set up)
    setup_res = requests.post(f"{base_url}/api/setup", json={
        "server_name": "Test Server",
        "username": "testadmin",
        "password": "password"
    })
    assert setup_res.status_code in [201, 409], f"Setup failed: {setup_res.text}"
    
    # 2. Login to get the cookie
    res = requests.post(f"{base_url}/api/auth/login", json={
        "username": "testadmin",
        "password": "password"
    })
    assert res.status_code == 200, "Admin login failed"
    return res.cookies

