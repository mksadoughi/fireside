package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// APIKey represents a row from the api_keys table (never includes the raw key).
type APIKey struct {
	ID        int        `json:"id"`
	KeyPrefix string     `json:"key_prefix"`
	UserID    int        `json:"user_id"`
	Name      string     `json:"name"`
	RateLimit int        `json:"rate_limit"`
	LastUsed  *time.Time `json:"last_used_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

// --- Database methods ---

// CreateAPIKey generates a new API key for a user.
// Returns the APIKey metadata and the raw key (shown once, never stored).
func (db *DB) CreateAPIKey(userID int, name string) (*APIKey, string, error) {
	rawBytes := make([]byte, 36)
	if _, err := rand.Read(rawBytes); err != nil {
		return nil, "", fmt.Errorf("generating key: %w", err)
	}
	rawKey := "sk-" + hex.EncodeToString(rawBytes)
	prefix := rawKey[:11] // "sk-" + first 8 hex chars

	hash := sha256.Sum256([]byte(rawKey))
	keyHash := hex.EncodeToString(hash[:])

	result, err := db.conn.Exec(`
		INSERT INTO api_keys (key_hash, key_prefix, user_id, name)
		VALUES (?, ?, ?, ?)
	`, keyHash, prefix, userID, name)
	if err != nil {
		return nil, "", fmt.Errorf("inserting api key: %w", err)
	}

	id, _ := result.LastInsertId()
	return &APIKey{
		ID:        int(id),
		KeyPrefix: prefix,
		UserID:    userID,
		Name:      name,
		RateLimit: 100,
	}, rawKey, nil
}

// ValidateAPIKey checks a raw API key. Returns the associated user if valid.
func (db *DB) ValidateAPIKey(rawKey string) (*User, error) {
	hash := sha256.Sum256([]byte(rawKey))
	keyHash := hex.EncodeToString(hash[:])

	var userID int
	err := db.conn.QueryRow(`
		SELECT user_id FROM api_keys WHERE key_hash = ?
	`, keyHash).Scan(&userID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	// Update last_used timestamp
	db.conn.Exec(`UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key_hash = ?`, keyHash)

	return db.GetUserByID(userID)
}

// ListAPIKeys returns all API keys for admin view.
func (db *DB) ListAPIKeys() ([]APIKey, error) {
	rows, err := db.conn.Query(`
		SELECT id, key_prefix, user_id, name, rate_limit, last_used_at, created_at
		FROM api_keys ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []APIKey
	for rows.Next() {
		var k APIKey
		if err := rows.Scan(&k.ID, &k.KeyPrefix, &k.UserID, &k.Name, &k.RateLimit, &k.LastUsed, &k.CreatedAt); err != nil {
			return nil, err
		}
		keys = append(keys, k)
	}
	return keys, rows.Err()
}

// DeleteAPIKey revokes an API key.
func (db *DB) DeleteAPIKey(id int) error {
	_, err := db.conn.Exec(`DELETE FROM api_keys WHERE id = ?`, id)
	return err
}

// --- HTTP handlers ---

func handleCreateAPIKey(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		var req struct {
			Name string `json:"name"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		if req.Name == "" {
			req.Name = "default"
		}

		key, rawKey, err := db.CreateAPIKey(user.ID, req.Name)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("failed to create key: %v", err)})
			return
		}

		writeJSON(w, http.StatusCreated, map[string]any{
			"key":     key,
			"api_key": rawKey,
			"warning": "Save this key now. It won't be shown again.",
		})
	}
}

func handleListAPIKeys(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		keys, err := db.ListAPIKeys()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list keys"})
			return
		}
		if keys == nil {
			keys = []APIKey{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"api_keys": keys})
	}
}

func handleDeleteAPIKey(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var id int
		if _, err := fmt.Sscanf(r.PathValue("id"), "%d", &id); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid key ID"})
			return
		}
		if err := db.DeleteAPIKey(id); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to delete key"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	}
}

// --- API key auth middleware ---

// requireAPIKey authenticates via the Authorization: Bearer header.
func requireAPIKey(db *DB, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			fmt.Fprint(w, `{"error":{"message":"Missing API key. Include 'Authorization: Bearer sk-...' header.","type":"invalid_request_error","code":"missing_api_key"}}`)
			return
		}

		rawKey := strings.TrimPrefix(auth, "Bearer ")
		user, err := db.ValidateAPIKey(rawKey)
		if err != nil || user == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			fmt.Fprint(w, `{"error":{"message":"Invalid API key.","type":"invalid_request_error","code":"invalid_api_key"}}`)
			return
		}

		ctx := context.WithValue(r.Context(), userContextKey, user)
		next(w, r.WithContext(ctx))
	}
}
