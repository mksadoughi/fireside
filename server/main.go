package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// uiDir is resolved at startup to serve the UI files.
var uiDir string

func defaultDataDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ".fireside"
	}
	return filepath.Join(home, ".fireside")
}

func main() {
	port := flag.Int("port", 3000, "port to listen on")
	ollamaURL := flag.String("ollama-url", "http://localhost:11434", "Ollama API base URL")
	dataDir := flag.String("data-dir", defaultDataDir(), "data directory for database and config")
	flag.Parse()

	dbPath := filepath.Join(*dataDir, "data.db")
	db, err := OpenDB(dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()
	log.Printf("Database: %s", dbPath)

	ollama := NewOllamaClient(*ollamaURL)

	mux := http.NewServeMux()

	// Resolve UI directory (look for ../ui relative to the binary, or CWD)
	uiDir = findUIDir()
	if uiDir != "" {
		log.Printf("Serving UI from: %s", uiDir)
		mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServer(http.Dir(uiDir))))
		mux.HandleFunc("GET /", serveIndex)
	}

	// Public endpoints
	mux.HandleFunc("GET /health", handleHealth(db))
	mux.HandleFunc("GET /api/setup/status", handleSetupStatus(db))
	mux.HandleFunc("POST /api/setup", handleSetup(db))
	mux.HandleFunc("POST /api/auth/login", handleLogin(db))
	mux.HandleFunc("POST /api/auth/logout", handleLogout(db))
	mux.HandleFunc("POST /api/auth/register", handleRegister(db))

	// Authenticated endpoints
	mux.HandleFunc("GET /api/auth/me", requireAuth(db, handleMe(db)))
	mux.HandleFunc("GET /api/models", requireAuth(db, handleListModels(ollama)))
	mux.HandleFunc("POST /api/chat", requireAuth(db, handleChatWithHistory(db, ollama)))
	mux.HandleFunc("POST /api/chat/stream", requireAuth(db, handleChatStreamWithHistory(db, ollama)))
	mux.HandleFunc("GET /api/conversations", requireAuth(db, handleListConversations(db)))
	mux.HandleFunc("GET /api/conversations/{id}", requireAuth(db, handleGetConversation(db)))
	mux.HandleFunc("DELETE /api/conversations/{id}", requireAuth(db, handleDeleteConversation(db)))

	// Admin endpoints
	mux.HandleFunc("POST /api/admin/invites", requireAdmin(db, handleCreateInvite(db)))
	mux.HandleFunc("GET /api/admin/invites", requireAdmin(db, handleListInvites(db)))
	mux.HandleFunc("DELETE /api/admin/invites/{id}", requireAdmin(db, handleDeleteInvite(db)))

	addr := fmt.Sprintf(":%d", *port)
	server := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 5 * time.Minute,
	}

	log.Printf("Fireside server starting on http://localhost%s", addr)
	log.Printf("Ollama backend: %s", *ollamaURL)
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func handleHealth(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		serverName, _ := db.GetConfig("server_name")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":      "ok",
			"server_name": serverName,
		})
	}
}

func serveIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" && r.URL.Path != "/index.html" {
		// For any unmatched path, serve index.html (SPA-style routing)
		http.ServeFile(w, r, filepath.Join(uiDir, "index.html"))
		return
	}
	http.ServeFile(w, r, filepath.Join(uiDir, "index.html"))
}

func findUIDir() string {
	// Check relative to CWD: ../ui (when running from server/ during development)
	candidates := []string{
		"../ui",
		"ui",
		"./ui",
	}

	// Also check relative to executable
	if exe, err := os.Executable(); err == nil {
		candidates = append(candidates, filepath.Join(filepath.Dir(exe), "..", "ui"))
	}

	for _, dir := range candidates {
		abs, err := filepath.Abs(dir)
		if err != nil {
			continue
		}
		if _, err := os.Stat(filepath.Join(abs, "index.html")); err == nil {
			return abs
		}
	}

	log.Println("Warning: UI directory not found, web interface will not be available")
	return ""
}

func handleListModels(ollama *OllamaClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		models, err := ollama.ListModels()
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%s"}`, err), http.StatusBadGateway)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"models": models,
		})
	}
}

// ConversationChatRequest extends ChatRequest with an optional conversation ID.
type ConversationChatRequest struct {
	ConversationID *int   `json:"conversation_id"`
	Model          string `json:"model"`
	Message        string `json:"message"`
}

func handleChatWithHistory(db *DB, ollama *OllamaClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		var req ConversationChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}
		if req.Model == "" || req.Message == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "model and message are required"})
			return
		}

		convo, messages, err := prepareChat(db, user, &req)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		// Add current message to history
		messages = append(messages, ChatMessage{Role: "user", Content: req.Message})

		resp, err := ollama.Chat(req.Model, messages)
		if err != nil {
			log.Printf("Ollama error: %v", err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("inference failed: %v", err)})
			return
		}

		// Save both messages
		db.AddMessage(convo.ID, "user", req.Message, nil)
		db.AddMessage(convo.ID, "assistant", resp.Message.Content, nil)

		writeJSON(w, http.StatusOK, map[string]any{
			"conversation_id": convo.ID,
			"model":           resp.Model,
			"message":         resp.Message,
		})
	}
}

func handleChatStreamWithHistory(db *DB, ollama *OllamaClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		var req ConversationChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}
		if req.Model == "" || req.Message == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "model and message are required"})
			return
		}

		convo, messages, err := prepareChat(db, user, &req)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		messages = append(messages, ChatMessage{Role: "user", Content: req.Message})

		flusher, ok := w.(http.Flusher)
		if !ok {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "streaming not supported"})
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		// Send conversation_id as first event so the client knows which convo this is
		fmt.Fprintf(w, "data: {\"conversation_id\":%d}\n\n", convo.ID)
		flusher.Flush()

		// Save user message
		db.AddMessage(convo.ID, "user", req.Message, nil)

		var fullResponse string
		err = ollama.ChatStream(req.Model, messages, func(chunk StreamChunk) error {
			fullResponse += chunk.Content
			data, _ := json.Marshal(chunk)
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
			return nil
		})

		if err != nil {
			log.Printf("Stream error: %v", err)
			fmt.Fprintf(w, "data: {\"error\":\"%s\"}\n\n", err)
			flusher.Flush()
			return
		}

		// Save assistant response
		db.AddMessage(convo.ID, "assistant", fullResponse, nil)

		fmt.Fprintf(w, "data: [DONE]\n\n")
		flusher.Flush()
	}
}

// prepareChat loads or creates a conversation and its message history.
func prepareChat(db *DB, user *User, req *ConversationChatRequest) (*Conversation, []ChatMessage, error) {
	var convo *Conversation
	var chatMessages []ChatMessage

	if req.ConversationID != nil {
		var err error
		convo, err = db.GetConversation(*req.ConversationID, user.ID)
		if err != nil {
			return nil, nil, fmt.Errorf("database error: %v", err)
		}
		if convo == nil {
			return nil, nil, fmt.Errorf("conversation not found")
		}

		// Load existing messages as context for the LLM
		stored, err := db.GetMessages(convo.ID, user.ID)
		if err != nil {
			return nil, nil, fmt.Errorf("loading messages: %v", err)
		}
		for _, m := range stored {
			chatMessages = append(chatMessages, ChatMessage{Role: m.Role, Content: m.Content})
		}
	} else {
		// Create new conversation, use first ~50 chars of message as title
		title := req.Message
		if len(title) > 50 {
			title = title[:50] + "..."
		}
		var err error
		convo, err = db.CreateConversation(user.ID, req.Model, title)
		if err != nil {
			return nil, nil, fmt.Errorf("creating conversation: %v", err)
		}
	}

	return convo, chatMessages, nil
}

func handleListConversations(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		convos, err := db.ListConversations(user.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list conversations"})
			return
		}
		if convos == nil {
			convos = []Conversation{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"conversations": convos})
	}
}

func handleGetConversation(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		var id int
		if _, err := fmt.Sscanf(r.PathValue("id"), "%d", &id); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid conversation ID"})
			return
		}

		convo, err := db.GetConversation(id, user.ID)
		if err != nil || convo == nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "conversation not found"})
			return
		}

		messages, err := db.GetMessages(convo.ID, user.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load messages"})
			return
		}
		if messages == nil {
			messages = []Message{}
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"conversation": convo,
			"messages":     messages,
		})
	}
}

func handleDeleteConversation(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		var id int
		if _, err := fmt.Sscanf(r.PathValue("id"), "%d", &id); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid conversation ID"})
			return
		}

		if err := db.DeleteConversation(id, user.ID); err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "conversation not found"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	}
}
