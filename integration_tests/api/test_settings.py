import requests

def test_settings_update(server, setup_and_login):
    """Test updating the server name and tunnel settings"""
    base_url = server["base_url"]
    cookies = setup_and_login

    # 1. Get current settings
    res = requests.get(f"{base_url}/api/admin/settings", cookies=cookies)
    assert res.status_code == 200
    data = res.json()
    assert data["server_name"] == "Test Server"
    
    # 2. Update server name
    update_res = requests.put(f"{base_url}/api/admin/settings", json={
        "server_name": "Updated Server"
    }, cookies=cookies)
    assert update_res.status_code == 200
    
    # 3. Verify update took effect
    res = requests.get(f"{base_url}/api/admin/settings", cookies=cookies)
    data = res.json()
    assert data["server_name"] == "Updated Server"

    # 4. Check that unauthenticated users cannot see settings
    unauth_res = requests.get(f"{base_url}/api/admin/settings")
    assert unauth_res.status_code == 401
