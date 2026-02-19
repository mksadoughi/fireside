package main

import (
	"database/sql"
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
// For now, content is stored as plaintext. Encryption will be added in Phase 3.
func (db *DB) AddMessage(conversationID int, role, content string, tokenCount *int) (*Message, error) {
	result, err := db.conn.Exec(`
		INSERT INTO messages (conversation_id, role, content_encrypted, content_iv, token_count)
		VALUES (?, ?, ?, ?, ?)
	`, conversationID, role, []byte(content), []byte("plaintext"), tokenCount)
	if err != nil {
		return nil, fmt.Errorf("inserting message: %w", err)
	}

	id, _ := result.LastInsertId()
	db.touchConversation(conversationID)

	return &Message{
		ID:             int(id),
		ConversationID: conversationID,
		Role:           role,
		Content:        content,
		TokenCount:     tokenCount,
	}, nil
}

// GetMessages returns all messages in a conversation, oldest first.
// For now, reads plaintext. Encryption will be added in Phase 3.
func (db *DB) GetMessages(conversationID, userID int) ([]Message, error) {
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
		SELECT id, conversation_id, role, content_encrypted, token_count, created_at
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
		if err := rows.Scan(&m.ID, &m.ConversationID, &m.Role, &contentBytes, &m.TokenCount, &m.CreatedAt); err != nil {
			return nil, err
		}
		m.Content = string(contentBytes)
		messages = append(messages, m)
	}
	return messages, rows.Err()
}
