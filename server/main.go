package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fireside/ui"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// Data dir resolution and constants
func defaultDataDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ".fireside"
	}
	return filepath.Join(home, ".fireside")
}

func main() {
	port := flag.Int("port", 7654, "port to listen on")
	ollamaURL := flag.String("ollama-url", "http://localhost:11434", "Ollama API base URL")
	dataDir := flag.String("data-dir", defaultDataDir(), "data directory for database and config")
	resetAdminPassword := flag.String("reset-admin", "", "force completely resets the password for the admin account to the specified password")
	noTunnel := flag.Bool("no-tunnel", false, "disable Cloudflare tunnel (server is only accessible on localhost)")
	verbose := flag.Bool("verbose", false, "show detailed startup logs")
	flag.Parse()

	// Helper for debug-level logging (only shown with --verbose)
	debugf := func(format string, args ...any) {
		if *verbose {
			log.Printf(format, args...)
		}
	}

	dbPath := filepath.Join(*dataDir, "data.db")
	db, err := OpenDB(dbPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "\n  ✗ Failed to open database: %v\n\n", err)
		os.Exit(1)
	}
	defer db.Close()
	debugf("Database: %s", dbPath)

	if *resetAdminPassword != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(*resetAdminPassword), 12)
		if err != nil {
			fmt.Fprintf(os.Stderr, "\n  ✗ Failed to hash new password: %v\n\n", err)
			os.Exit(1)
		}
		res, err := db.conn.Exec("UPDATE users SET password_hash = ? WHERE is_admin = 1", string(hash))
		if err != nil {
			fmt.Fprintf(os.Stderr, "\n  ✗ Failed to update admin password: %v\n\n", err)
			os.Exit(1)
		}
		rows, _ := res.RowsAffected()
		if rows == 0 {
			fmt.Fprintf(os.Stderr, "\n  ✗ No admin user found. Please complete initial setup first.\n\n")
			os.Exit(1)
		}

		// Invalidate all active sessions for the admin user so they are forcefully logged out
		if _, err := db.conn.Exec("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE is_admin = 1)"); err != nil {
			debugf("Warning: failed to clear active admin sessions: %v", err)
		}

		fmt.Print("\n  ✓ Admin password updated. You may now start the server normally.\n\n")
		os.Exit(0)
	}

	initPauseState(db)

	ollama := NewOllamaClient(*ollamaURL)

	// --- Tunnel provider ---
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var tunnel TunnelProvider
	var tunnelURL string

	if *noTunnel {
		tunnel = &NoopTunnelProvider{}
		debugf("Tunnel: disabled (--no-tunnel)")
	} else if HasNamedTunnel(db) {
		tunnel = NewNamedTunnelProvider(db)
		debugf("Tunnel: using named tunnel (permanent subdomain)")
	} else {
		tunnel = NewCloudflaredProvider(*port)
		debugf("Tunnel: using quick tunnel")
	}

	urlCh, tunnelErr := tunnel.Start(ctx)
	if tunnelErr != nil {
		debugf("Tunnel: failed to start: %v", tunnelErr)
	} else {
		// Wait up to 15 seconds for the first URL
		select {
		case url, ok := <-urlCh:
			if ok && url != "" {
				tunnelURL = url
				db.SetConfig("tunnel_url", url)
			}
		case <-time.After(15 * time.Second):
			debugf("Tunnel: timed out waiting for URL")
		}

		// Continue watching for URL changes (reconnects) in the background
		if urlCh != nil {
			go func() {
				for url := range urlCh {
					db.SetConfig("tunnel_url", url)
					debugf("Tunnel: URL updated: %s", url)
				}
			}()
		}
	}

	// Heartbeat: if a named tunnel is claimed, ping the registration Worker daily
	if HasNamedTunnel(db) {
		go func() {
			sendHeartbeat(db)
			ticker := time.NewTicker(24 * time.Hour)
			defer ticker.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					sendHeartbeat(db)
				}
			}
		}()
	}

	// Hot-swap callback: switches from Quick Tunnel → Named Tunnel after a successful claim
	activateNamedTunnel := func() {
		tunnel.Stop()
		cancel()

		newCtx, newCancel := context.WithCancel(context.Background())
		named := NewNamedTunnelProvider(db)
		newUrlCh, err := named.Start(newCtx)
		if err != nil {
			log.Printf("Tunnel hot-swap failed: %v", err)
			newCancel()
			return
		}

		tunnel = named
		cancel = newCancel
		_ = ctx // old ctx is done
		ctx = newCtx

		go func() {
			for url := range newUrlCh {
				db.SetConfig("tunnel_url", url)
			}
		}()

		// Start heartbeat for the new named tunnel
		go func() {
			sendHeartbeat(db)
			ticker := time.NewTicker(24 * time.Hour)
			defer ticker.Stop()
			for {
				select {
				case <-newCtx.Done():
					return
				case <-ticker.C:
					sendHeartbeat(db)
				}
			}
		}()

		log.Printf("Tunnel: hot-swapped to named tunnel")
	}

	mux := http.NewServeMux()

	debugf("Serving UI from embedded static files")
	mux.Handle("GET /assets/", http.FileServer(http.FS(ui.Dist)))

	// SPA routes — serve index.html for all known frontend paths + root
	mux.HandleFunc("GET /", serveSPA)
	mux.HandleFunc("GET /chat", serveSPA)
	mux.HandleFunc("GET /dashboard", serveSPA)
	mux.HandleFunc("GET /login", serveSPA)
	mux.HandleFunc("GET /setup", serveSPA)
	mux.HandleFunc("GET /invite/{token}", serveSPA)

	// Public endpoints
	mux.HandleFunc("GET /health", handleHealth(db))
	mux.HandleFunc("GET /api/status", handleServerStatus(db))
	mux.HandleFunc("GET /api/setup/status", handleSetupStatus(db))
	mux.HandleFunc("POST /api/setup", handleSetup(db))
	mux.HandleFunc("POST /api/auth/login", handleLogin(db))
	mux.HandleFunc("POST /api/auth/logout", handleLogout(db))
	mux.HandleFunc("POST /api/auth/register", handleRegister(db))
	mux.HandleFunc("GET /api/invite/{token}", handleValidateInvite(db))

	// Authenticated endpoints
	mux.HandleFunc("GET /api/auth/me", requireAuth(db, handleMe(db)))
	mux.HandleFunc("GET /api/models", requireAuth(db, handleListModels(ollama)))
	mux.HandleFunc("POST /api/chat", requireAuth(db, handleChatWithHistory(db, ollama)))
	mux.HandleFunc("POST /api/chat/stream", requireAuth(db, handleChatStreamWithHistory(db, ollama)))
	mux.HandleFunc("GET /api/conversations", requireAuth(db, handleListConversations(db)))
	mux.HandleFunc("GET /api/conversations/{id}", requireAuth(db, handleGetConversation(db)))
	mux.HandleFunc("DELETE /api/conversations/{id}", requireAuth(db, handleDeleteConversation(db)))
	mux.HandleFunc("PUT /api/auth/password", requireAuth(db, handleChangePassword(db)))

	// Admin endpoints
	mux.HandleFunc("POST /api/admin/invites", requireAdmin(db, handleCreateInvite(db)))
	mux.HandleFunc("GET /api/admin/invites", requireAdmin(db, handleListInvites(db)))
	mux.HandleFunc("DELETE /api/admin/invites/{id}", requireAdmin(db, handleDeleteInvite(db)))

	mux.HandleFunc("GET /api/admin/users", requireAdmin(db, handleListUsers(db)))
	mux.HandleFunc("DELETE /api/admin/users/{id}", requireAdmin(db, handleDeleteUser(db)))
	mux.HandleFunc("PUT /api/admin/users/{id}/password", requireAdmin(db, handleAdminResetPassword(db)))

	// Admin: API key management
	mux.HandleFunc("POST /api/admin/api-keys", requireAdmin(db, handleCreateAPIKey(db)))
	mux.HandleFunc("GET /api/admin/api-keys", requireAdmin(db, handleListAPIKeys(db)))
	mux.HandleFunc("DELETE /api/admin/api-keys/{id}", requireAdmin(db, handleDeleteAPIKey(db)))

	// Admin: Stats, Hardware, Models, Settings
	mux.HandleFunc("GET /api/admin/stats", requireAdmin(db, handleAdminStats(db, ollama)))
	mux.HandleFunc("GET /api/admin/hardware", requireAdmin(db, handleGetHardware()))
	mux.HandleFunc("POST /api/admin/models/pull", requireAdmin(db, handlePullModel(ollama)))
	mux.HandleFunc("DELETE /api/admin/models", requireAdmin(db, handleDeleteModel(ollama)))
	mux.HandleFunc("GET /api/admin/models/running", requireAdmin(db, handleListRunningModels(ollama)))
	mux.HandleFunc("GET /api/admin/settings", requireAdmin(db, handleGetSettings(db, tunnel)))
	mux.HandleFunc("PUT /api/admin/settings", requireAdmin(db, handleUpdateSettings(db)))
	mux.HandleFunc("POST /api/admin/tunnel/check", requireAdmin(db, handleTunnelCheck()))
	mux.HandleFunc("POST /api/admin/tunnel/claim", requireAdmin(db, handleTunnelClaim(db, activateNamedTunnel)))
	mux.HandleFunc("PUT /api/admin/password", requireAdmin(db, handleChangePassword(db)))
	mux.HandleFunc("POST /api/admin/reset", requireAdmin(db, handleResetServer(db)))

	// Admin: Pause toggle
	mux.HandleFunc("GET /api/admin/pause", requireAdmin(db, handleGetPause(db)))
	mux.HandleFunc("PUT /api/admin/pause", requireAdmin(db, handleSetPause(db)))

	// OpenAI-compatible API (authenticated via API key in Bearer token)
	mux.HandleFunc("POST /v1/chat/completions", requireAPIKey(db, handleOpenAIChatCompletions(db, ollama)))
	mux.HandleFunc("GET /v1/models", requireAPIKey(db, handleOpenAIListModels(ollama)))

	addr := fmt.Sprintf(":%d", *port)
	server := &http.Server{
		Addr:         addr,
		Handler:      securityHeaders(pauseMiddleware(db, mux)),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 5 * time.Minute,
	}

	// --- Print the clean startup banner ---
	printStartupBanner(db, ollama, *port, *verbose, tunnelURL)

	// Graceful shutdown on SIGINT/SIGTERM
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			if strings.Contains(err.Error(), "address already in use") {
				fmt.Fprintf(os.Stderr, "\n  %s✗%s Fireside is already running on port %d\n", red, nc, *port)
				fmt.Fprintf(os.Stderr, "    Stop it first, or run: %sfireside --port <other-port>%s\n\n", bold, nc)
			} else {
				fmt.Fprintf(os.Stderr, "\n  %s✗%s Server failed: %v\n\n", red, nc, err)
			}
			os.Exit(1)
		}
	}()

	<-stop
	fmt.Printf("\n  %sStopping...%s\n", dim, nc)

	tunnel.Stop()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	server.Shutdown(shutdownCtx)
}

// securityHeaders adds standard browser security headers to every response.
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		next.ServeHTTP(w, r)
	})
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

func serveSPA(w http.ResponseWriter, r *http.Request) {
	// Try serving static files from dist (favicon, icons, etc.)
	if r.URL.Path != "/" && !strings.HasPrefix(r.URL.Path, "/api/") && !strings.HasPrefix(r.URL.Path, "/v1/") {
		if f, err := ui.Dist.(fs.ReadFileFS).ReadFile(strings.TrimPrefix(r.URL.Path, "/")); err == nil {
			// Detect content type from extension
			ct := "application/octet-stream"
			switch {
			case strings.HasSuffix(r.URL.Path, ".svg"):
				ct = "image/svg+xml"
			case strings.HasSuffix(r.URL.Path, ".ico"):
				ct = "image/x-icon"
			case strings.HasSuffix(r.URL.Path, ".png"):
				ct = "image/png"
			case strings.HasSuffix(r.URL.Path, ".js"):
				ct = "application/javascript"
			case strings.HasSuffix(r.URL.Path, ".css"):
				ct = "text/css"
			}
			w.Header().Set("Content-Type", ct)
			w.Write(f)
			return
		}
	}

	// SPA catch-all: serve index.html for all non-API routes
	content, err := ui.Dist.(fs.ReadFileFS).ReadFile("index.html")
	if err != nil {
		http.Error(w, "UI not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write(content)
}

// --- Admin: Stats ---

func handleAdminStats(db *DB, ollama *OllamaClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var userCount, messagesToday, totalMessages, keyCount, inviteCount, activeSessions int

		db.conn.QueryRow("SELECT COUNT(*) FROM users").Scan(&userCount)
		db.conn.QueryRow("SELECT COUNT(*) FROM messages WHERE created_at >= date('now')").Scan(&messagesToday)
		db.conn.QueryRow("SELECT COUNT(*) FROM messages").Scan(&totalMessages)
		db.conn.QueryRow("SELECT COUNT(*) FROM api_keys").Scan(&keyCount)
		db.conn.QueryRow("SELECT COUNT(*) FROM invite_links").Scan(&inviteCount)
		db.conn.QueryRow("SELECT COUNT(*) FROM sessions WHERE expires_at > CURRENT_TIMESTAMP").Scan(&activeSessions)

		var modelCount int
		models, err := ollama.ListModels()
		if err == nil {
			modelCount = len(models)
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"users":           userCount,
			"messages_today":  messagesToday,
			"models":          modelCount,
			"active_sessions": activeSessions,
			"has_messages":    totalMessages > 0,
			"has_api_keys":    keyCount > 0,
			"has_invites":     inviteCount > 0,
			"has_models":      modelCount > 0,
		})
	}
}

// --- Admin: Model management ---

func handlePullModel(ollama *OllamaClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "model name required"})
			return
		}

		flusher, ok := w.(http.Flusher)
		if !ok {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "streaming not supported"})
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		err := ollama.PullModelStream(req.Name, func(line []byte) error {
			fmt.Fprintf(w, "data: %s\n\n", line)
			flusher.Flush()
			return nil
		})

		if err != nil {
			errJSON, _ := json.Marshal(map[string]string{"error": err.Error()})
			fmt.Fprintf(w, "data: %s\n\n", errJSON)
			flusher.Flush()
			return
		}

		fmt.Fprintf(w, "data: [DONE]\n\n")
		flusher.Flush()
	}
}

func handleDeleteModel(ollama *OllamaClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "model name required"})
			return
		}

		if err := ollama.DeleteModel(req.Name); err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("failed to delete model: %v", err)})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	}
}

func handleListRunningModels(ollama *OllamaClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		models, err := ollama.ListRunningModels()
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("failed to list running models: %v", err)})
			return
		}
		if models == nil {
			models = []RunningModel{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"models": models})
	}
}

// --- Admin: Settings ---

func handleGetSettings(db *DB, tunnel TunnelProvider) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		serverName, _ := db.GetConfig("server_name")
		tunnelURL, _ := db.GetConfig("tunnel_url")
		tunnelSubdomain, _ := db.GetConfig("tunnel_subdomain")
		writeJSON(w, http.StatusOK, map[string]any{
			"server_name":      serverName,
			"tunnel_url":       tunnelURL,
			"tunnel_mode":      tunnel.Mode(),
			"tunnel_subdomain": tunnelSubdomain,
		})
	}
}

func handleUpdateSettings(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			ServerName *string `json:"server_name"`
			TunnelURL  *string `json:"tunnel_url"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}
		if req.ServerName != nil {
			db.SetConfig("server_name", *req.ServerName)
		}
		if req.TunnelURL != nil {
			db.SetConfig("tunnel_url", *req.TunnelURL)
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
	}
}

func handleChangePassword(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		var req struct {
			CurrentPassword string `json:"current_password"`
			NewPassword     string `json:"new_password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}

		authUser, err := db.Authenticate(user.Username, req.CurrentPassword)
		if err != nil || authUser == nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "current password is incorrect"})
			return
		}

		if len(req.NewPassword) < 6 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "password must be at least 6 characters"})
			return
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 12)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to hash password"})
			return
		}

		if _, err := db.conn.Exec("UPDATE users SET password_hash = ? WHERE id = ?", string(hash), user.ID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update password"})
			return
		}

		// Invalidate all other sessions so stolen sessions can't be reused
		cookie, _ := r.Cookie("session")
		if cookie != nil {
			db.conn.Exec("DELETE FROM sessions WHERE user_id = ? AND id != ?", user.ID, cookie.Value)
		} else {
			db.conn.Exec("DELETE FROM sessions WHERE user_id = ?", user.ID)
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "password updated"})
	}
}

func handleAdminResetPassword(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.PathValue("id")

		var req struct {
			NewPassword string `json:"new_password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}

		if len(req.NewPassword) < 6 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "password must be at least 6 characters"})
			return
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 12)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to hash password"})
			return
		}

		result, err := db.conn.Exec("UPDATE users SET password_hash = ? WHERE id = ?", string(hash), userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update password"})
			return
		}
		rows, _ := result.RowsAffected()
		if rows == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}

		// Invalidate all sessions for the target user so they must re-login
		db.conn.Exec("DELETE FROM sessions WHERE user_id = ?", userID)

		writeJSON(w, http.StatusOK, map[string]string{"status": "password reset"})
	}
}

func handleResetServer(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Enforce localhost only — if Cf-Connecting-Ip header exists, it's coming through the tunnel
		if r.Header.Get("Cf-Connecting-Ip") != "" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "server reset can only be performed locally from the host machine"})
			return
		}

		host, _, _ := net.SplitHostPort(r.RemoteAddr)
		isLocal := host == "127.0.0.1" || host == "::1"

		if !isLocal {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "server reset can only be performed locally from the host machine"})
			return
		}

		if err := db.ResetServer(); err != nil {
			log.Printf("Failed to reset server: %v", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to reset database"})
			return
		}

		// Reset the rate limiter map on server wipe
		loginAttempts = sync.Map{}

		writeJSON(w, http.StatusOK, map[string]string{"status": "reset"})
	}
}

func handleListModels(ollama *OllamaClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		models, err := ollama.ListModels()
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("failed to list models: %v", err)})
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
	Model          string `json:"model"`
	Message        string `json:"message"`
	ConversationID *int   `json:"conversation_id,omitempty"`
	Encrypted      bool   `json:"encrypted"`
	IV             string `json:"iv"`
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

		if req.Encrypted && len(user.EncryptionKey) == 32 {
			ivBytes, err := base64.StdEncoding.DecodeString(req.IV)
			if err == nil {
				cipherBytes, err := base64.StdEncoding.DecodeString(req.Message)
				if err == nil {
					plaintext, err := DecryptAESGCM(user.EncryptionKey, ivBytes, cipherBytes)
					if err == nil {
						req.Message = string(plaintext)
					}
				}
			}
		}

		convo, messages, err := prepareChat(db, user, &req)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		// Add current message to history
		messages = append(messages, ChatMessage{Role: "user", Content: req.Message})

		resp, err := ollama.Chat(req.Model, messages, nil)
		if err != nil {
			log.Printf("Ollama error: %v", err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("inference failed: %v", err)})
			return
		}

		// Save both messages
		db.AddMessage(convo.ID, "user", req.Message, nil, user.EncryptionKey)
		db.AddMessage(convo.ID, "assistant", resp.Message.Content, nil, user.EncryptionKey)

		if req.Encrypted && len(user.EncryptionKey) == 32 {
			cipherBytes, ivBytes, err := EncryptAESGCM(user.EncryptionKey, []byte(resp.Message.Content))
			if err == nil {
				resp.Message.Content = base64.StdEncoding.EncodeToString(cipherBytes)
				resp.Message.IV = base64.StdEncoding.EncodeToString(ivBytes)
				resp.Message.Encrypted = true
			}
		}

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

		if req.Encrypted && len(user.EncryptionKey) == 32 {
			ivBytes, err := base64.StdEncoding.DecodeString(req.IV)
			if err == nil {
				cipherBytes, err := base64.StdEncoding.DecodeString(req.Message)
				if err == nil {
					plaintext, err := DecryptAESGCM(user.EncryptionKey, ivBytes, cipherBytes)
					if err == nil {
						req.Message = string(plaintext)
					}
				}
			}
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
		db.AddMessage(convo.ID, "user", req.Message, nil, user.EncryptionKey)

		var fullResponse string
		err = ollama.ChatStream(req.Model, messages, nil, func(chunk StreamChunk) error {
			fullResponse += chunk.Content

			if req.Encrypted && len(user.EncryptionKey) == 32 {
				cipherBytes, ivBytes, err := EncryptAESGCM(user.EncryptionKey, []byte(chunk.Content))
				if err == nil {
					chunk.Content = base64.StdEncoding.EncodeToString(cipherBytes)
					chunk.IV = base64.StdEncoding.EncodeToString(ivBytes)
					chunk.Encrypted = true
				}
			}

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
		db.AddMessage(convo.ID, "assistant", fullResponse, nil, user.EncryptionKey)

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
		stored, err := db.GetMessages(convo.ID, user.ID, user.EncryptionKey, true)
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

		messages, err := db.GetMessages(convo.ID, user.ID, user.EncryptionKey, false)
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
