package main

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"sync/atomic"
)

// pausedCache is an in-memory cache of the paused state to avoid DB hits on every request.
// Initialized from DB on startup, updated when admin toggles.
var pausedCache atomic.Bool

// initPauseState loads the paused state from DB into the atomic cache.
func initPauseState(db *DB) {
	val, _ := db.GetConfig("server_paused")
	pausedCache.Store(val == "true")
}

// pauseMiddleware wraps the entire mux. When paused, remote requests are blocked
// while local requests (and certain essential paths) are allowed through.
func pauseMiddleware(db *DB, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !pausedCache.Load() {
			next.ServeHTTP(w, r)
			return
		}

		// Always allow local requests
		if isLocalRequest(r) {
			next.ServeHTTP(w, r)
			return
		}

		// Allow essential paths even when paused for remote users:
		// - SPA and static assets (so users see the paused message in-app)
		// - Auth endpoints (so sessions still work)
		// - Status endpoint (so frontend knows why it's blocked)
		// - Health check
		path := r.URL.Path
		if path == "/" ||
			strings.HasPrefix(path, "/assets/") ||
			path == "/health" ||
			path == "/api/setup/status" ||
			path == "/api/auth/login" ||
			path == "/api/auth/logout" ||
			path == "/api/auth/me" ||
			path == "/api/status" {
			next.ServeHTTP(w, r)
			return
		}

		// Block everything else for remote requests
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]any{
			"error":   "server_paused",
			"message": "This server is temporarily paused by the host. Please try again later.",
		})
	})
}

// isLocalRequest checks if the request originates from localhost.
func isLocalRequest(r *http.Request) bool {
	// Cloudflare tunnel sets this header — if present, the request is remote
	if r.Header.Get("Cf-Connecting-Ip") != "" {
		return false
	}
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	return host == "127.0.0.1" || host == "::1"
}

func handleGetPause(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]bool{
			"paused": pausedCache.Load(),
		})
	}
}

func handleSetPause(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Paused bool `json:"paused"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}

		val := "false"
		if req.Paused {
			val = "true"
		}
		if err := db.SetConfig("server_paused", val); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to save"})
			return
		}
		pausedCache.Store(req.Paused)

		writeJSON(w, http.StatusOK, map[string]any{
			"paused": req.Paused,
		})
	}
}

// handleServerStatus is a public endpoint returning server name and pause state.
func handleServerStatus(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		serverName, _ := db.GetConfig("server_name")
		writeJSON(w, http.StatusOK, map[string]any{
			"paused":      pausedCache.Load(),
			"server_name": serverName,
			"status":      "ok",
		})
	}
}
