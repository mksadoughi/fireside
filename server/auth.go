package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// User represents a row from the users table.
type User struct {
	ID            int       `json:"id"`
	Username      string    `json:"username"`
	DisplayName   string    `json:"display_name,omitempty"`
	IsAdmin       bool      `json:"is_admin"`
	EncryptionKey []byte    `json:"-"`
	CreatedAt     time.Time `json:"created_at"`
}

type contextKey string

const userContextKey contextKey = "user"

// --- Database methods for auth ---

// CreateUser creates a new user with a hashed password.
// Returns the created user (without password hash).
func (db *DB) CreateUser(username, password string, isAdmin bool, encryptionKey []byte, inviteID *int) (*User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return nil, fmt.Errorf("hashing password: %w", err)
	}

	result, err := db.conn.Exec(`
		INSERT INTO users (username, password_hash, display_name, is_admin, encryption_key, invite_id)
		VALUES (?, ?, ?, ?, ?, ?)
	`, username, string(hash), username, isAdmin, encryptionKey, inviteID)
	if err != nil {
		return nil, fmt.Errorf("inserting user: %w", err)
	}

	id, _ := result.LastInsertId()
	return &User{
		ID:            int(id),
		Username:      username,
		DisplayName:   username,
		IsAdmin:       isAdmin,
		EncryptionKey: encryptionKey,
	}, nil
}

// Authenticate checks username + password. Returns the user if valid, nil if not.
func (db *DB) Authenticate(username, password string) (*User, error) {
	var user User
	var passwordHash string

	err := db.conn.QueryRow(`
		SELECT id, username, display_name, is_admin, encryption_key, created_at, password_hash
		FROM users WHERE username = ?
	`, username).Scan(
		&user.ID, &user.Username, &user.DisplayName,
		&user.IsAdmin, &user.EncryptionKey, &user.CreatedAt, &passwordHash,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("querying user: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)); err != nil {
		return nil, nil
	}

	return &user, nil
}

// GetUserByID looks up a user by their ID.
func (db *DB) GetUserByID(id int) (*User, error) {
	var user User
	err := db.conn.QueryRow(`
		SELECT id, username, display_name, is_admin, encryption_key, created_at
		FROM users WHERE id = ?
	`, id).Scan(
		&user.ID, &user.Username, &user.DisplayName,
		&user.IsAdmin, &user.EncryptionKey, &user.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// --- Session management ---

// CreateSession creates a new session for a user. Returns the session ID (cookie value).
func (db *DB) CreateSession(userID int) (string, error) {
	sessionID, err := randomHex(32)
	if err != nil {
		return "", fmt.Errorf("generating session ID: %w", err)
	}

	expiresAt := time.Now().Add(30 * 24 * time.Hour) // 30 days
	_, err = db.conn.Exec(`
		INSERT INTO sessions (id, user_id, expires_at)
		VALUES (?, ?, ?)
	`, sessionID, userID, expiresAt)
	if err != nil {
		return "", fmt.Errorf("inserting session: %w", err)
	}

	return sessionID, nil
}

// ValidateSession checks if a session ID is valid and not expired.
// Returns the associated user, or nil if the session is invalid.
func (db *DB) ValidateSession(sessionID string) (*User, error) {
	var userID int
	err := db.conn.QueryRow(`
		SELECT user_id FROM sessions
		WHERE id = ? AND expires_at > CURRENT_TIMESTAMP
	`, sessionID).Scan(&userID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	// Update last_active timestamp
	db.conn.Exec(`UPDATE sessions SET last_active = CURRENT_TIMESTAMP WHERE id = ?`, sessionID)

	return db.GetUserByID(userID)
}

// DeleteSession removes a session (logout).
func (db *DB) DeleteSession(sessionID string) error {
	_, err := db.conn.Exec(`DELETE FROM sessions WHERE id = ?`, sessionID)
	return err
}

// CleanExpiredSessions removes all expired sessions.
func (db *DB) CleanExpiredSessions() (int64, error) {
	result, err := db.conn.Exec(`DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP`)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// --- HTTP handlers ---

// handleSetupStatus tells the UI whether setup has been completed.
func handleSetupStatus(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		done, _ := db.IsSetupComplete()
		writeJSON(w, http.StatusOK, map[string]any{"setup_complete": done})
	}
}

// handleSetup creates the admin account. Only works if no setup has been done yet.
func handleSetup(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		done, err := db.IsSetupComplete()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "database error"})
			return
		}
		if done {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "setup already complete"})
			return
		}

		var req struct {
			Username   string `json:"username"`
			Password   string `json:"password"`
			ServerName string `json:"server_name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}
		if req.Username == "" || req.Password == "" || req.ServerName == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "username, password, and server_name are required"})
			return
		}
		if len(req.Password) < 6 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "password must be at least 6 characters"})
			return
		}

		// Generate an encryption key for the admin user
		encKey := make([]byte, 32)
		if _, err := rand.Read(encKey); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to generate encryption key"})
			return
		}

		user, err := db.CreateUser(req.Username, req.Password, true, encKey, nil)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("failed to create admin: %v", err)})
			return
		}

		db.SetConfig("server_name", req.ServerName)
		db.SetConfig("setup_complete", "true")

		sessionID, err := db.CreateSession(user.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "account created but session failed"})
			return
		}

		setSessionCookie(w, sessionID)
		log.Printf("Setup complete: admin=%q, server=%q", req.Username, req.ServerName)
		writeJSON(w, http.StatusCreated, map[string]any{
			"user":        user,
			"server_name": req.ServerName,
		})
	}
}

func handleLogin(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}

		user, err := db.Authenticate(req.Username, req.Password)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "authentication failed"})
			return
		}
		if user == nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid username or password"})
			return
		}

		sessionID, err := db.CreateSession(user.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create session"})
			return
		}

		setSessionCookie(w, sessionID)
		writeJSON(w, http.StatusOK, map[string]any{"user": user})
	}
}

func handleLogout(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("session")
		if err == nil {
			db.DeleteSession(cookie.Value)
		}
		http.SetCookie(w, &http.Cookie{
			Name:     "session",
			Value:    "",
			Path:     "/",
			MaxAge:   -1,
			HttpOnly: true,
		})
		writeJSON(w, http.StatusOK, map[string]string{"status": "logged out"})
	}
}

func handleMe(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		if user == nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"user": user})
	}
}

// --- Middleware ---

// requireAuth is middleware that checks for a valid session cookie.
// If valid, it adds the user to the request context.
func requireAuth(db *DB, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("session")
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
			return
		}

		user, err := db.ValidateSession(cookie.Value)
		if err != nil || user == nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid or expired session"})
			return
		}

		ctx := context.WithValue(r.Context(), userContextKey, user)
		next(w, r.WithContext(ctx))
	}
}

// requireAdmin is middleware that checks the user is an admin.
func requireAdmin(db *DB, next http.HandlerFunc) http.HandlerFunc {
	return requireAuth(db, func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		if user == nil || !user.IsAdmin {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "admin access required"})
			return
		}
		next(w, r)
	})
}

// UserFromContext extracts the authenticated user from the request context.
func UserFromContext(ctx context.Context) *User {
	user, _ := ctx.Value(userContextKey).(*User)
	return user
}

// --- Helpers ---

func setSessionCookie(w http.ResponseWriter, sessionID string) {
	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    sessionID,
		Path:     "/",
		MaxAge:   30 * 24 * 60 * 60, // 30 days
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func randomHex(n int) (string, error) {
	bytes := make([]byte, n)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
