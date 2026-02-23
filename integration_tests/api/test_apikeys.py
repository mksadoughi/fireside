import requests

def test_apikey_lifecycle_and_usage(server, setup_and_login):
    """Test creating an API key, using it to call an OpenAI compatible endpoint, and then deleting it"""
    base_url = server["base_url"]
    cookies = setup_and_login

    # 1. Create API key
    res = requests.post(f"{base_url}/api/admin/api-keys", json={"name": "test-key"}, cookies=cookies)
    assert res.status_code == 201
    data = res.json()
    assert "api_key" in data, "Should return raw api_key exactly once"
    raw_key = data["api_key"]
    
    # Verify it appears in the list (without the raw key)
    list_res = requests.get(f"{base_url}/api/admin/api-keys", cookies=cookies)
    assert list_res.status_code == 200
    keys = list_res.json()["api_keys"]
    
    # Find the created key
    created_key_info = next((k for k in keys if k["id"] == data["key"]["id"]), None)
    assert created_key_info is not None
    assert created_key_info["name"] == "test-key"
    assert "api_key" not in created_key_info, "API keys list MUST NOT contain raw keys"
    
    # 2. Use the API key
    # Calling the OpenAI compatible models endpoint
    models_res = requests.get(
        f"{base_url}/v1/models",
        headers={"Authorization": f"Bearer {raw_key}"}
    )
    # Could be 200 (if ollama is reachable) or 502 (if ollama is not). 
    # But it should NOT be 401 Unauthorized.
    assert models_res.status_code != 401, "API Key should successfully authenticate against /v1 endpoints"
    
    # 3. Test invalid API key
    invalid_res = requests.get(
        f"{base_url}/v1/models",
        headers={"Authorization": "Bearer sk-invalidkey12345"}
    )
    assert invalid_res.status_code == 401, "Invalid API key should be rejected"
    
    # 4. Revoke the API key
    key_id = data["key"]["id"]
    delete_res = requests.delete(f"{base_url}/api/admin/api-keys/{key_id}", cookies=cookies)
    assert delete_res.status_code == 200
    
    # Verify it was removed
    list_after_res = requests.get(f"{base_url}/api/admin/api-keys", cookies=cookies)
    keys_after = list_after_res.json()["api_keys"]
    assert not any(k["id"] == key_id for k in keys_after)
    
    # 5. Try using revoked key
    revoked_use_res = requests.get(
        f"{base_url}/v1/models",
        headers={"Authorization": f"Bearer {raw_key}"}
    )
    assert revoked_use_res.status_code == 401, "Revoked API Key must not work"
