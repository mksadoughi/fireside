package main

import (
	"database/sql"
	"encoding/base64"
	"fmt"
	"time"
)

// Conversation represents a chat conversation.
type Conversation struct {
	ID        int       `json:"id"`
	UserID    int       `json:"user_id"`
	Title     string    `json:"title"`
	Model     string    `json:"model"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Message represents a stored chat message.
type Message struct {
	ID             int       `json:"id"`
	ConversationID int       `json:"conversation_id"`
	Role           string    `json:"role"`
	Content        string    `json:"content"`
	Encrypted      bool      `json:"encrypted,omitempty"`
	IV             string    `json:"iv,omitempty"`
	TokenCount     *int      `json:"token_count,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

// --- Database methods ---

// CreateConversation starts a new conversation for a user.
func (db *DB) CreateConversation(userID int, model string, title string) (*Conversation, error) {
	if title == "" {
		title = "New conversation"
	}

	result, err := db.conn.Exec(`
		INSERT INTO conversations (user_id, title, model)
		VALUES (?, ?, ?)
	`, userID, title, model)
	if err != nil {
		return nil, fmt.Errorf("inserting conversation: %w", err)
	}

	id, _ := result.LastInsertId()
	return &Conversation{
		ID:     int(id),
		UserID: userID,
		Title:  title,
		Model:  model,
	}, nil
}

// ListConversations returns all conversations for a user, newest first.
func (db *DB) ListConversations(userID int) ([]Conversation, error) {
	rows, err := db.conn.Query(`
		SELECT id, user_id, title, model, created_at, updated_at
		FROM conversations WHERE user_id = ?
		ORDER BY updated_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var convos []Conversation
	for rows.Next() {
		var c Conversation
		if err := rows.Scan(&c.ID, &c.UserID, &c.Title, &c.Model, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		convos = append(convos, c)
	}
	return convos, rows.Err()
}

// GetConversation returns a single conversation if it belongs to the user.
func (db *DB) GetConversation(id, userID int) (*Conversation, error) {
	var c Conversation
	err := db.conn.QueryRow(`
		SELECT id, user_id, title, model, created_at, updated_at
		FROM conversations WHERE id = ? AND user_id = ?
	`, id, userID).Scan(&c.ID, &c.UserID, &c.Title, &c.Model, &c.CreatedAt, &c.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// DeleteConversation deletes a conversation and its messages (CASCADE).
func (db *DB) DeleteConversation(id, userID int) error {
	result, err := db.conn.Exec(`DELETE FROM conversations WHERE id = ? AND user_id = ?`, id, userID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("conversation not found")
	}
	return nil
}

// UpdateConversationTitle updates the title of a conversation.
func (db *DB) UpdateConversationTitle(id, userID int, title string) error {
	_, err := db.conn.Exec(`
		UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ? AND user_id = ?
	`, title, id, userID)
	return err
}

// touchConversation updates the updated_at timestamp.
func (db *DB) touchConversation(id int) {
	db.conn.Exec(`UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, id)
}

// AddMessage stores a message in a conversation.
// Encrypts the content using the user's per-user AES-256 key before storing.
func (db *DB) AddMessage(conversationID int, role, content string, tokenCount *int, encryptionKey []byte) (*Message, error) {
	var ciphertext, iv []byte
	var err error

	if len(encryptionKey) == 32 {
		ciphertext, iv, err = EncryptAESGCM(encryptionKey, []byte(content))
		if err != nil {
			return nil, fmt.Errorf("encryption failed: %w", err)
		}
	} else {
		// Fallback to plaintext if no valid key is provided (legacy behavior)
		ciphertext = []byte(content)
		iv = []byte("plaintext")
	}

	result, err := db.conn.Exec(`
		INSERT INTO messages (conversation_id, role, content_encrypted, content_iv, token_count)
		VALUES (?, ?, ?, ?, ?)
	`, conversationID, role, ciphertext, iv, tokenCount)
	if err != nil {
		return nil, fmt.Errorf("inserting message: %w", err)
	}

	id, _ := result.LastInsertId()
	db.touchConversation(conversationID)

	return &Message{
		ID:             int(id),
		ConversationID: conversationID,
		Role:           role,
		Content:        content, // Return plaintext to caller
		TokenCount:     tokenCount,
	}, nil
}

// GetMessages returns all messages in a conversation, oldest first.
// If decrypt is true, decrypts messages using the user's encryption key.
// If decrypt is false, serves raw base64 cipher and IV strings for the client.
func (db *DB) GetMessages(conversationID, userID int, encryptionKey []byte, decrypt bool) ([]Message, error) {
	// Verify the conversation belongs to the user
	var ownerID int
	err := db.conn.QueryRow(`SELECT user_id FROM conversations WHERE id = ?`, conversationID).Scan(&ownerID)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("conversation not found")
	}
	if err != nil {
		return nil, err
	}
	if ownerID != userID {
		return nil, fmt.Errorf("conversation not found")
	}

	rows, err := db.conn.Query(`
		SELECT id, conversation_id, role, content_encrypted, content_iv, token_count, created_at
		FROM messages WHERE conversation_id = ?
		ORDER BY created_at ASC
	`, conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var m Message
		var contentBytes []byte
		var ivBytes []byte
		if err := rows.Scan(&m.ID, &m.ConversationID, &m.Role, &contentBytes, &ivBytes, &m.TokenCount, &m.CreatedAt); err != nil {
			return nil, err
		}

		if string(ivBytes) == "plaintext" {
			m.Content = string(contentBytes)
		} else if decrypt {
			if len(encryptionKey) == 32 {
				plaintext, err := DecryptAESGCM(encryptionKey, ivBytes, contentBytes)
				if err != nil {
					m.Content = "[Encrypted Content: Decryption Failed]"
				} else {
					m.Content = string(plaintext)
				}
			} else {
				m.Content = "[Encrypted Content: Missing Key]"
			}
		} else {
			m.Content = base64.StdEncoding.EncodeToString(contentBytes)
			m.Encrypted = true
			m.IV = base64.StdEncoding.EncodeToString(ivBytes)
		}

		messages = append(messages, m)
	}
	return messages, rows.Err()
}
