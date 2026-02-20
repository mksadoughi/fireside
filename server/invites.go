package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Invite represents a row from the invite_links table.
type Invite struct {
	ID        int        `json:"id"`
	Token     string     `json:"token"`
	MaxUses   int        `json:"max_uses"`
	Uses      int        `json:"uses"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

// --- Database methods ---

// CreateInvite generates a new invite link with its own encryption key.
func (db *DB) CreateInvite(createdBy int, maxUses int, expiresAt *time.Time) (*Invite, string, error) {
	token, err := randomURLSafe(18)
	if err != nil {
		return nil, "", fmt.Errorf("generating token: %w", err)
	}

	encKey := make([]byte, 32)
	if _, err := rand.Read(encKey); err != nil {
		return nil, "", fmt.Errorf("generating encryption key: %w", err)
	}

	result, err := db.conn.Exec(`
		INSERT INTO invite_links (token, encryption_key, created_by, max_uses, expires_at)
		VALUES (?, ?, ?, ?, ?)
	`, token, encKey, createdBy, maxUses, expiresAt)
	if err != nil {
		return nil, "", fmt.Errorf("inserting invite: %w", err)
	}

	id, _ := result.LastInsertId()
	invite := &Invite{
		ID:        int(id),
		Token:     token,
		MaxUses:   maxUses,
		Uses:      0,
		ExpiresAt: expiresAt,
	}

	encKeyB64 := base64.URLEncoding.EncodeToString(encKey)
	return invite, encKeyB64, nil
}

// ValidateInvite checks that a token is valid, not expired, and not used up.
// Returns the invite and its encryption key if valid.
func (db *DB) ValidateInvite(token string) (*Invite, []byte, error) {
	var invite Invite
	var encKey []byte

	err := db.conn.QueryRow(`
		SELECT id, token, encryption_key, max_uses, uses, expires_at, created_at
		FROM invite_links WHERE token = ?
	`, token).Scan(
		&invite.ID, &invite.Token, &encKey,
		&invite.MaxUses, &invite.Uses, &invite.ExpiresAt, &invite.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, fmt.Errorf("querying invite: %w", err)
	}

	if invite.Uses >= invite.MaxUses {
		return nil, nil, nil
	}
	if invite.ExpiresAt != nil && invite.ExpiresAt.Before(time.Now()) {
		return nil, nil, nil
	}

	return &invite, encKey, nil
}

// ConsumeInvite increments the use count of an invite.
func (db *DB) ConsumeInvite(inviteID int) error {
	_, err := db.conn.Exec(`UPDATE invite_links SET uses = uses + 1 WHERE id = ?`, inviteID)
	return err
}

// ListInvites returns all invites (for admin dashboard).
func (db *DB) ListInvites() ([]Invite, error) {
	rows, err := db.conn.Query(`
		SELECT id, token, max_uses, uses, expires_at, created_at
		FROM invite_links ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invites []Invite
	for rows.Next() {
		var inv Invite
		if err := rows.Scan(&inv.ID, &inv.Token, &inv.MaxUses, &inv.Uses, &inv.ExpiresAt, &inv.CreatedAt); err != nil {
			return nil, err
		}
		invites = append(invites, inv)
	}
	return invites, rows.Err()
}

// DeleteInvite revokes an invite link.
func (db *DB) DeleteInvite(id int) error {
	_, err := db.conn.Exec(`DELETE FROM invite_links WHERE id = ?`, id)
	return err
}

// --- HTTP handlers ---

// handleCreateInvite lets the admin create a new invite link.
func handleCreateInvite(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			MaxUses   int    `json:"max_uses"`
			ExpiresIn string `json:"expires_in"` // e.g. "24h", "7d", "" for never
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}

		if req.MaxUses <= 0 {
			req.MaxUses = 1
		}

		var expiresAt *time.Time
		if req.ExpiresIn != "" {
			d, err := parseDuration(req.ExpiresIn)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid expires_in format (use '24h', '7d', etc.)"})
				return
			}
			t := time.Now().Add(d)
			expiresAt = &t
		}

		user := UserFromContext(r.Context())
		invite, encKeyB64, err := db.CreateInvite(user.ID, req.MaxUses, expiresAt)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("failed to create invite: %v", err)})
			return
		}

		// Build the full invite URL (the Host will share this)
		serverName, _ := db.GetConfig("tunnel_url")
		if serverName == "" {
			serverName = "http://localhost:7654"
		}
		inviteURL := fmt.Sprintf("%s/invite/%s#key=%s", serverName, invite.Token, encKeyB64)

		writeJSON(w, http.StatusCreated, map[string]any{
			"invite": invite,
			"url":    inviteURL,
		})
	}
}

// handleListInvites returns all invites for the admin.
func handleListInvites(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		invites, err := db.ListInvites()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list invites"})
			return
		}
		if invites == nil {
			invites = []Invite{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"invites": invites})
	}
}

// handleDeleteInvite revokes an invite link.
func handleDeleteInvite(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := r.PathValue("id")
		var id int
		if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid invite ID"})
			return
		}

		if err := db.DeleteInvite(id); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to delete invite"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	}
}

// handleValidateInvite checks if an invite token is valid (for the invite registration page).
// This is a public endpoint — no auth required.
func handleValidateInvite(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := r.PathValue("token")
		invite, _, err := db.ValidateInvite(token)
		if err != nil || invite == nil {
			writeJSON(w, http.StatusOK, map[string]any{"valid": false})
			return
		}

		serverName, _ := db.GetConfig("server_name")
		writeJSON(w, http.StatusOK, map[string]any{
			"valid":       true,
			"server_name": serverName,
		})
	}
}

// handleRegister lets a new user sign up using an invite token.
func handleRegister(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Token    string `json:"token"`
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}
		if req.Token == "" || req.Username == "" || req.Password == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "token, username, and password are required"})
			return
		}
		if len(req.Password) < 6 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "password must be at least 6 characters"})
			return
		}

		invite, encKey, err := db.ValidateInvite(req.Token)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to validate invite"})
			return
		}
		if invite == nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid, expired, or already used invite link"})
			return
		}

		user, err := db.CreateUser(req.Username, req.Password, false, encKey, &invite.ID)
		if err != nil {
			writeJSON(w, http.StatusConflict, map[string]string{"error": fmt.Sprintf("failed to create account: %v", err)})
			return
		}

		if err := db.ConsumeInvite(invite.ID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "account created but invite tracking failed"})
			return
		}

		sessionID, err := db.CreateSession(user.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "account created but session failed"})
			return
		}

		setSessionCookie(w, sessionID)
		writeJSON(w, http.StatusCreated, map[string]any{"user": user})
	}
}

// --- Helpers ---

func randomURLSafe(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// parseDuration handles "24h", "7d", "30d" style durations.
func parseDuration(s string) (time.Duration, error) {
	if len(s) < 2 {
		return 0, fmt.Errorf("too short")
	}

	unit := s[len(s)-1]
	numStr := s[:len(s)-1]
	var num int
	if _, err := fmt.Sscanf(numStr, "%d", &num); err != nil {
		return 0, err
	}

	switch unit {
	case 'h':
		return time.Duration(num) * time.Hour, nil
	case 'd':
		return time.Duration(num) * 24 * time.Hour, nil
	default:
		return 0, fmt.Errorf("unknown unit %q (use 'h' or 'd')", string(unit))
	}
}
