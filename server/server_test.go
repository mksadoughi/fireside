package main

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// testDB creates a fresh SQLite database in a temp directory.
// Automatically closed when the test finishes.
func testDB(t *testing.T) *DB {
	t.Helper()
	db, err := OpenDB(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("OpenDB: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

// testEncKey returns a random 32-byte AES-256 key.
func testEncKey(t *testing.T) []byte {
	t.Helper()
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		t.Fatal(err)
	}
	return key
}

// mockOllama spins up a fake Ollama HTTP server that returns canned responses.
// Good enough to test that Fireside formats the OpenAI response correctly.
func mockOllama(t *testing.T) *OllamaClient {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/tags":
			json.NewEncoder(w).Encode(map[string]any{
				"models": []map[string]any{
					{
						"name":        "qwen3:8b",
						"model":       "qwen3:8b",
						"size":        4500000000,
						"modified_at": "2025-06-01T00:00:00Z",
						"details": map[string]string{
							"family":             "qwen",
							"parameter_size":     "8B",
							"quantization_level": "Q4_0",
						},
					},
				},
			})
		case "/api/chat":
			json.NewEncoder(w).Encode(map[string]any{
				"message": map[string]string{
					"role":    "assistant",
					"content": "Hello from mock Ollama!",
				},
				"done": true,
			})
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	return &OllamaClient{BaseURL: srv.URL, HTTPClient: srv.Client()}
}

// postJSON is a test helper that creates an HTTP POST request with JSON body.
func postJSON(t *testing.T, path string, body any) *http.Request {
	t.Helper()
	b, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("POST", path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = "127.0.0.1:9999"
	return req
}

// ---------------------------------------------------------------------------
// Layer 1: Core data logic (no HTTP, no Ollama)
// ---------------------------------------------------------------------------

// TestAuthLifecycle verifies the complete authentication chain:
// create user → authenticate → session → validate → logout → session gone.
// If this breaks, nobody can use the product.
func TestAuthLifecycle(t *testing.T) {
	db := testDB(t)
	key := testEncKey(t)

	// Create user
	user, err := db.CreateUser("alice", "password123", true, key, nil)
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	if user.Username != "alice" || !user.IsAdmin {
		t.Fatalf("unexpected user: %+v", user)
	}

	// Correct password → user returned
	authed, err := db.Authenticate("alice", "password123")
	if err != nil || authed == nil {
		t.Fatalf("Authenticate should succeed: err=%v", err)
	}

	// Wrong password → nil, no error
	bad, err := db.Authenticate("alice", "wrong")
	if err != nil {
		t.Fatalf("Authenticate err: %v", err)
	}
	if bad != nil {
		t.Fatal("wrong password should return nil user")
	}

	// Non-existent user → nil, no error
	ghost, err := db.Authenticate("nobody", "whatever")
	if err != nil {
		t.Fatalf("Authenticate err: %v", err)
	}
	if ghost != nil {
		t.Fatal("non-existent user should return nil")
	}

	// Create session and validate it
	sessionID, err := db.CreateSession(user.ID)
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	sessionUser, err := db.ValidateSession(sessionID)
	if err != nil || sessionUser == nil {
		t.Fatalf("ValidateSession should return user: err=%v", err)
	}
	if sessionUser.ID != user.ID {
		t.Fatalf("session user ID %d != expected %d", sessionUser.ID, user.ID)
	}

	// Delete session (logout), then validate → nil
	db.DeleteSession(sessionID)
	gone, _ := db.ValidateSession(sessionID)
	if gone != nil {
		t.Fatal("deleted session should not validate")
	}
}

// TestEncryptionRoundTrip verifies AES-256-GCM encrypt→decrypt works
// and that a wrong key is properly rejected (not silently returning garbage).
func TestEncryptionRoundTrip(t *testing.T) {
	key := testEncKey(t)
	plaintext := []byte("Hello, this is a secret message for testing encryption!")

	ciphertext, iv, err := EncryptAESGCM(key, plaintext)
	if err != nil {
		t.Fatalf("EncryptAESGCM: %v", err)
	}

	// Correct key → original plaintext
	decrypted, err := DecryptAESGCM(key, iv, ciphertext)
	if err != nil {
		t.Fatalf("DecryptAESGCM: %v", err)
	}
	if string(decrypted) != string(plaintext) {
		t.Fatalf("decrypted %q != plaintext %q", decrypted, plaintext)
	}

	// Wrong key → must error (GCM authentication tag check)
	wrongKey := testEncKey(t)
	_, err = DecryptAESGCM(wrongKey, iv, ciphertext)
	if err == nil {
		t.Fatal("decryption with wrong key should fail")
	}
}

// TestAPIKeyLifecycle verifies create → validate → revoke → validate-fails.
// If this breaks, all external integrations (LangChain, Open WebUI, curl) stop working.
func TestAPIKeyLifecycle(t *testing.T) {
	db := testDB(t)
	user, _ := db.CreateUser("admin", "pass123456", true, testEncKey(t), nil)

	// Create
	apiKey, rawKey, err := db.CreateAPIKey(user.ID, "test-key")
	if err != nil {
		t.Fatalf("CreateAPIKey: %v", err)
	}
	if len(rawKey) < 11 || rawKey[:3] != "sk-" {
		t.Fatalf("raw key format wrong: %q", rawKey)
	}
	if apiKey.Name != "test-key" {
		t.Fatalf("key name %q != %q", apiKey.Name, "test-key")
	}

	// Validate with correct key
	validUser, err := db.ValidateAPIKey(rawKey)
	if err != nil || validUser == nil {
		t.Fatalf("ValidateAPIKey should succeed: err=%v", err)
	}
	if validUser.ID != user.ID {
		t.Fatalf("validated user %d != expected %d", validUser.ID, user.ID)
	}

	// Validate with wrong key → nil
	fakeUser, _ := db.ValidateAPIKey("sk-0000000000000000000000000000000000000000000000000000000000000000000000000000")
	if fakeUser != nil {
		t.Fatal("wrong key should not validate")
	}

	// Revoke → validate fails
	db.DeleteAPIKey(apiKey.ID)
	revokedUser, _ := db.ValidateAPIKey(rawKey)
	if revokedUser != nil {
		t.Fatal("revoked key should not validate")
	}
}

// TestInviteRegisterLifecycle verifies the full invite flow:
// create invite → validate → register user → consume → second use rejected.
// If this breaks, nobody can join the server.
func TestInviteRegisterLifecycle(t *testing.T) {
	db := testDB(t)
	admin, _ := db.CreateUser("admin", "pass123456", true, testEncKey(t), nil)

	// Create invite (max_uses=1)
	invite, encKeyB64, err := db.CreateInvite(admin.ID, 1, nil)
	if err != nil {
		t.Fatalf("CreateInvite: %v", err)
	}
	if invite.Token == "" || encKeyB64 == "" {
		t.Fatal("invite token and encryption key must not be empty")
	}

	// Validate
	validInvite, inviteEncKey, err := db.ValidateInvite(invite.Token)
	if err != nil || validInvite == nil {
		t.Fatalf("ValidateInvite should succeed: err=%v", err)
	}
	if len(inviteEncKey) != 32 {
		t.Fatalf("invite encryption key should be 32 bytes, got %d", len(inviteEncKey))
	}

	// Register user with this invite
	newUser, err := db.CreateUser("bob", "pass123456", false, inviteEncKey, &invite.ID)
	if err != nil {
		t.Fatalf("CreateUser via invite: %v", err)
	}
	if newUser.IsAdmin {
		t.Fatal("invited user should not be admin")
	}

	// Consume invite
	if err := db.ConsumeInvite(invite.ID); err != nil {
		t.Fatalf("ConsumeInvite: %v", err)
	}

	// Second validation should fail (max_uses=1, uses=1)
	used, _, _ := db.ValidateInvite(invite.Token)
	if used != nil {
		t.Fatal("consumed single-use invite should not validate again")
	}
}

// TestMessageEncryptionStorage verifies that messages are encrypted at rest
// and can be correctly decrypted on retrieval.
// This is the core privacy promise of Fireside.
func TestMessageEncryptionStorage(t *testing.T) {
	db := testDB(t)
	key := testEncKey(t)
	user, _ := db.CreateUser("alice", "pass123456", false, key, nil)
	convo, _ := db.CreateConversation(user.ID, "test-model", "Test chat")

	original := "This message should be encrypted at rest in SQLite"
	if _, err := db.AddMessage(convo.ID, "user", original, nil, key); err != nil {
		t.Fatalf("AddMessage: %v", err)
	}

	// Retrieve with decryption → original plaintext
	msgs, err := db.GetMessages(convo.ID, user.ID, key, true)
	if err != nil {
		t.Fatalf("GetMessages(decrypt=true): %v", err)
	}
	if len(msgs) != 1 || msgs[0].Content != original {
		t.Fatalf("decrypted content %q != original %q", msgs[0].Content, original)
	}

	// Retrieve without decryption → base64 ciphertext, NOT plaintext
	raw, _ := db.GetMessages(convo.ID, user.ID, key, false)
	if raw[0].Content == original {
		t.Fatal("raw retrieval should not return plaintext")
	}
	if !raw[0].Encrypted {
		t.Fatal("raw retrieval should have encrypted=true")
	}
}

// TestConversationIsolation verifies that one user cannot access
// another user's conversations or messages. Critical security property.
func TestConversationIsolation(t *testing.T) {
	db := testDB(t)
	alice, _ := db.CreateUser("alice", "pass123456", false, testEncKey(t), nil)
	bob, _ := db.CreateUser("bob", "pass123456", false, testEncKey(t), nil)

	convo, _ := db.CreateConversation(alice.ID, "model", "Alice's private chat")
	db.AddMessage(convo.ID, "user", "secret", nil, alice.EncryptionKey)

	// Bob tries to access Alice's conversation → nil
	stolen, _ := db.GetConversation(convo.ID, bob.ID)
	if stolen != nil {
		t.Fatal("Bob should NOT access Alice's conversation")
	}

	// Bob tries to read Alice's messages → error
	_, err := db.GetMessages(convo.ID, bob.ID, bob.EncryptionKey, true)
	if err == nil {
		t.Fatal("Bob should NOT read Alice's messages")
	}
}

// ---------------------------------------------------------------------------
// Layer 2: HTTP handler tests (with httptest, mock Ollama)
// ---------------------------------------------------------------------------

// TestSetupAndLoginHTTP verifies the full HTTP setup and login flow,
// including session cookies and the /api/auth/me endpoint.
func TestSetupAndLoginHTTP(t *testing.T) {
	db := testDB(t)

	// --- Setup ---
	rec := httptest.NewRecorder()
	handleSetup(db)(rec, postJSON(t, "/api/setup", map[string]string{
		"username": "admin", "password": "pass123456", "server_name": "TestServer",
	}))
	if rec.Code != 201 {
		t.Fatalf("setup: expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	// setup_complete flag is set
	done, _ := db.IsSetupComplete()
	if !done {
		t.Fatal("setup_complete should be true")
	}

	// Second setup → 409 Conflict
	rec2 := httptest.NewRecorder()
	handleSetup(db)(rec2, postJSON(t, "/api/setup", map[string]string{
		"username": "admin2", "password": "pass123456", "server_name": "Dup",
	}))
	if rec2.Code != 409 {
		t.Fatalf("duplicate setup: expected 409, got %d", rec2.Code)
	}

	// --- Login ---
	rec3 := httptest.NewRecorder()
	handleLogin(db)(rec3, postJSON(t, "/api/auth/login", map[string]string{
		"username": "admin", "password": "pass123456",
	}))
	if rec3.Code != 200 {
		t.Fatalf("login: expected 200, got %d: %s", rec3.Code, rec3.Body.String())
	}

	// Session cookie was set
	var sessionCookie *http.Cookie
	for _, c := range rec3.Result().Cookies() {
		if c.Name == "session" {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil || sessionCookie.Value == "" {
		t.Fatal("login should set a session cookie")
	}

	// --- Use session to call /api/auth/me ---
	meReq := httptest.NewRequest("GET", "/api/auth/me", nil)
	meReq.AddCookie(sessionCookie)
	meRec := httptest.NewRecorder()
	requireAuth(db, handleMe(db))(meRec, meReq)
	if meRec.Code != 200 {
		t.Fatalf("/api/auth/me: expected 200, got %d: %s", meRec.Code, meRec.Body.String())
	}

	// --- Unauthenticated access → 401 ---
	noAuthReq := httptest.NewRequest("GET", "/api/auth/me", nil)
	noAuthRec := httptest.NewRecorder()
	requireAuth(db, handleMe(db))(noAuthRec, noAuthReq)
	if noAuthRec.Code != 401 {
		t.Fatalf("unauthed /api/auth/me: expected 401, got %d", noAuthRec.Code)
	}

	// --- Wrong password login → 401 ---
	rec4 := httptest.NewRecorder()
	handleLogin(db)(rec4, postJSON(t, "/api/auth/login", map[string]string{
		"username": "admin", "password": "wrongpassword",
	}))
	if rec4.Code != 401 {
		t.Fatalf("bad login: expected 401, got %d", rec4.Code)
	}
}

// TestOpenAICompletionFormat verifies /v1/chat/completions returns the exact
// JSON structure that the Python openai client, LangChain, and Open WebUI expect.
// This is the #1 integration test — if this format is wrong, every external
// client breaks silently.
func TestOpenAICompletionFormat(t *testing.T) {
	db := testDB(t)
	ollama := mockOllama(t)
	user, _ := db.CreateUser("admin", "pass123456", true, testEncKey(t), nil)
	_, rawKey, _ := db.CreateAPIKey(user.ID, "test")

	handler := requireAPIKey(db, handleOpenAIChatCompletions(db, ollama))

	req := postJSON(t, "/v1/chat/completions", openAIRequest{
		Model:    "qwen3:8b",
		Messages: []ChatMessage{{Role: "user", Content: "Hello"}},
		Stream:   false,
	})
	req.Header.Set("Authorization", "Bearer "+rawKey)

	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	// Decode and verify every field that OpenAI clients depend on
	var resp openAIResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}

	if resp.ID == "" {
		t.Fatal("response.id must not be empty")
	}
	if resp.Object != "chat.completion" {
		t.Fatalf("response.object = %q, want %q", resp.Object, "chat.completion")
	}
	if resp.Model != "qwen3:8b" {
		t.Fatalf("response.model = %q, want %q", resp.Model, "qwen3:8b")
	}
	if resp.Created == 0 {
		t.Fatal("response.created must not be zero")
	}
	if len(resp.Choices) != 1 {
		t.Fatalf("expected 1 choice, got %d", len(resp.Choices))
	}

	choice := resp.Choices[0]
	if choice.Index != 0 {
		t.Fatalf("choice.index = %d, want 0", choice.Index)
	}
	if choice.Message == nil {
		t.Fatal("choice.message must not be nil")
	}
	if choice.Message.Role != "assistant" {
		t.Fatalf("message.role = %q, want %q", choice.Message.Role, "assistant")
	}
	if choice.Message.Content == "" {
		t.Fatal("message.content must not be empty")
	}
	if choice.FinishReason == nil || *choice.FinishReason != "stop" {
		t.Fatal("finish_reason must be 'stop'")
	}
	if resp.Usage == nil {
		t.Fatal("usage must not be nil")
	}
}

// TestOpenAIModelsFormat verifies GET /v1/models returns the OpenAI list format
// that clients use to discover available models.
func TestOpenAIModelsFormat(t *testing.T) {
	db := testDB(t)
	ollama := mockOllama(t)
	user, _ := db.CreateUser("admin", "pass123456", true, testEncKey(t), nil)
	_, rawKey, _ := db.CreateAPIKey(user.ID, "test")

	handler := requireAPIKey(db, handleOpenAIListModels(ollama))

	req := httptest.NewRequest("GET", "/v1/models", nil)
	req.Header.Set("Authorization", "Bearer "+rawKey)

	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != 200 {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp openAIModelsResponse
	json.NewDecoder(rec.Body).Decode(&resp)

	if resp.Object != "list" {
		t.Fatalf("object = %q, want %q", resp.Object, "list")
	}
	if len(resp.Data) != 1 {
		t.Fatalf("expected 1 model, got %d", len(resp.Data))
	}
	if resp.Data[0].ID != "qwen3:8b" {
		t.Fatalf("model ID = %q, want %q", resp.Data[0].ID, "qwen3:8b")
	}
	if resp.Data[0].Object != "model" {
		t.Fatalf("model.object = %q, want %q", resp.Data[0].Object, "model")
	}
	if resp.Data[0].OwnedBy != "local" {
		t.Fatalf("model.owned_by = %q, want %q", resp.Data[0].OwnedBy, "local")
	}
}

// TestAPIKeyAuthMiddleware verifies the API key middleware correctly rejects
// requests with missing or invalid keys. External tools get proper error responses.
func TestAPIKeyAuthMiddleware(t *testing.T) {
	db := testDB(t)

	dummy := func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]string{"ok": "true"})
	}
	handler := requireAPIKey(db, dummy)

	// No Authorization header → 401
	rec := httptest.NewRecorder()
	handler(rec, httptest.NewRequest("GET", "/v1/models", nil))
	if rec.Code != 401 {
		t.Fatalf("no auth: expected 401, got %d", rec.Code)
	}

	// Invalid key → 401
	req := httptest.NewRequest("GET", "/v1/models", nil)
	req.Header.Set("Authorization", "Bearer sk-bogus")
	rec2 := httptest.NewRecorder()
	handler(rec2, req)
	if rec2.Code != 401 {
		t.Fatalf("bad key: expected 401, got %d", rec2.Code)
	}

	// Valid key → 200
	user, _ := db.CreateUser("admin", "pass123456", true, testEncKey(t), nil)
	_, rawKey, _ := db.CreateAPIKey(user.ID, "real")
	req3 := httptest.NewRequest("GET", "/v1/models", nil)
	req3.Header.Set("Authorization", "Bearer "+rawKey)
	rec3 := httptest.NewRecorder()
	handler(rec3, req3)
	if rec3.Code != 200 {
		t.Fatalf("valid key: expected 200, got %d: %s", rec3.Code, rec3.Body.String())
	}
}

// TestOpenAIOptionsTranslation verifies that OpenAI parameters (temperature,
// max_tokens, etc.) are correctly translated to Ollama's format.
func TestOpenAIOptionsTranslation(t *testing.T) {
	temp := 0.7
	maxTok := 100
	topP := 0.9

	opts := buildOllamaOptions(&openAIRequest{
		Temperature: &temp,
		MaxTokens:   &maxTok,
		TopP:        &topP,
	})

	if opts["temperature"] != 0.7 {
		t.Fatalf("temperature = %v, want 0.7", opts["temperature"])
	}
	if opts["num_predict"] != 100 {
		t.Fatalf("num_predict = %v, want 100", opts["num_predict"])
	}
	if opts["top_p"] != 0.9 {
		t.Fatalf("top_p = %v, want 0.9", opts["top_p"])
	}
}
