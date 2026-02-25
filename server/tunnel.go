package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

// TunnelProvider abstracts the networking layer that makes the server publicly reachable.
// CloudflareTunnelProvider (Quick Tunnel) is used by default.
// NamedTunnelProvider is used after a host claims a name.fireside.run subdomain.
type TunnelProvider interface {
	// Start begins the tunnel. The returned channel emits the public URL whenever it
	// is known or changes (e.g. on reconnect). The channel is closed when the context
	// is cancelled or Stop is called.
	Start(ctx context.Context) (<-chan string, error)
	// Stop shuts down the tunnel gracefully.
	Stop()
	// Mode returns "auto" (managed by Fireside) or "manual" (user-configured).
	Mode() string
}

// --- CloudflareTunnelProvider (Quick Tunnel) ---

var trycloudflareRe = regexp.MustCompile(`https://[a-z0-9-]+\.trycloudflare\.com`)

// CloudflareTunnelProvider spawns cloudflared and captures the public trycloudflare URL.
// If cloudflared exits unexpectedly, it respawns with exponential backoff.
type CloudflareTunnelProvider struct {
	port int
	cmd  *exec.Cmd
	stop context.CancelFunc
}

func NewCloudflaredProvider(port int) *CloudflareTunnelProvider {
	return &CloudflareTunnelProvider{port: port}
}

func (p *CloudflareTunnelProvider) Mode() string { return "auto" }

func (p *CloudflareTunnelProvider) Start(ctx context.Context) (<-chan string, error) {
	// Check if cloudflared is available
	if _, err := exec.LookPath("cloudflared"); err != nil {
		return nil, fmt.Errorf("cloudflared not found in PATH")
	}

	urlCh := make(chan string, 1)
	go p.runLoop(ctx, urlCh)
	return urlCh, nil
}

func (p *CloudflareTunnelProvider) runLoop(ctx context.Context, urlCh chan<- string) {
	defer close(urlCh)

	backoff := 2 * time.Second
	const maxBackoff = 60 * time.Second

	for {
		if ctx.Err() != nil {
			return
		}

		if err := p.runOnce(ctx, urlCh); err != nil && ctx.Err() == nil {
			log.Printf("Tunnel: cloudflared exited (%v), retrying in %s", err, backoff)
		}

		if ctx.Err() != nil {
			return
		}

		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}

		backoff *= 2
		if backoff > maxBackoff {
			backoff = maxBackoff
		}
	}
}

func (p *CloudflareTunnelProvider) runOnce(ctx context.Context, urlCh chan<- string) error {
	cmd := exec.CommandContext(ctx, "cloudflared", "tunnel", "--url",
		fmt.Sprintf("http://localhost:%d", p.port))

	// cloudflared prints the URL to stderr
	pr, pw := io.Pipe()
	cmd.Stdout = pw
	cmd.Stderr = pw

	if err := cmd.Start(); err != nil {
		pw.Close()
		pr.Close()
		return err
	}

	p.cmd = cmd

	// Scan output for the trycloudflare URL
	go func() {
		scanner := bufio.NewScanner(pr)
		for scanner.Scan() {
			line := scanner.Text()
			if m := trycloudflareRe.FindString(line); m != "" {
				select {
				case urlCh <- m:
				default:
				}
			}
		}
	}()

	err := cmd.Wait()
	pw.Close()
	pr.Close()
	return err
}

func (p *CloudflareTunnelProvider) Stop() {
	if p.cmd != nil && p.cmd.Process != nil {
		_ = p.cmd.Process.Kill()
	}
}

// --- NamedTunnelProvider ---

// NamedTunnelProvider runs a Cloudflare Named Tunnel using credentials claimed
// from api.fireside.run during first-run setup. The host gets a permanent
// name.fireside.run subdomain that never changes on restart.
//
// Credentials are stored in the DB:
//
//	tunnel_token     — cloudflared tunnel token (from our registration Worker)
//	tunnel_subdomain — e.g. "alice.fireside.run"
type NamedTunnelProvider struct {
	db        *DB
	cmd       *exec.Cmd
	subdomain string
}

func NewNamedTunnelProvider(db *DB) *NamedTunnelProvider {
	return &NamedTunnelProvider{db: db}
}

func (p *NamedTunnelProvider) Mode() string { return "auto" }

func (p *NamedTunnelProvider) Start(ctx context.Context) (<-chan string, error) {
	token, _ := p.db.GetConfig("tunnel_token")
	subdomain, _ := p.db.GetConfig("tunnel_subdomain")

	if token == "" || subdomain == "" {
		return nil, fmt.Errorf("named tunnel not configured")
	}

	p.subdomain = subdomain
	urlCh := make(chan string, 1)
	go p.runLoop(ctx, token, urlCh)
	return urlCh, nil
}

func (p *NamedTunnelProvider) runLoop(ctx context.Context, token string, urlCh chan string) {
	defer close(urlCh)

	// URL is permanent and known immediately — emit it right away.
	urlCh <- "https://" + p.subdomain

	backoff := 2 * time.Second
	const maxBackoff = 60 * time.Second

	for {
		if ctx.Err() != nil {
			return
		}

		if err := p.runOnce(ctx, token); err != nil && ctx.Err() == nil {
			log.Printf("Tunnel: cloudflared exited (%v), retrying in %s", err, backoff)
		}

		if ctx.Err() != nil {
			return
		}

		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}

		backoff *= 2
		if backoff > maxBackoff {
			backoff = maxBackoff
		}
	}
}

func (p *NamedTunnelProvider) runOnce(ctx context.Context, token string) error {
	cmd := exec.CommandContext(ctx, "cloudflared", "tunnel", "run", "--token", token)
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	p.cmd = cmd
	if err := cmd.Start(); err != nil {
		return err
	}
	return cmd.Wait()
}

func (p *NamedTunnelProvider) Stop() {
	if p.cmd != nil && p.cmd.Process != nil {
		_ = p.cmd.Process.Kill()
	}
}

// HasNamedTunnel reports whether the DB contains named tunnel credentials.
func HasNamedTunnel(db *DB) bool {
	token, _ := db.GetConfig("tunnel_token")
	return token != ""
}

// --- NoopTunnelProvider ---

// NoopTunnelProvider is used when --no-tunnel is set.
// The server runs locally only; the admin sets the URL manually.
type NoopTunnelProvider struct{}

func (p *NoopTunnelProvider) Mode() string { return "manual" }

func (p *NoopTunnelProvider) Start(_ context.Context) (<-chan string, error) {
	ch := make(chan string)
	close(ch)
	return ch, nil
}

func (p *NoopTunnelProvider) Stop() {}

// --- Tunnel registration helpers (talk to api.fireside.run Worker) ---

const registrationAPI = "https://api.fireside.run"

// sendHeartbeat pings the registration Worker to keep the name alive.
func sendHeartbeat(db *DB) {
	subdomain, _ := db.GetConfig("tunnel_subdomain")
	instanceID, _ := db.GetConfig("instance_id")
	if subdomain == "" || instanceID == "" {
		return
	}
	// Extract just the name from "alice.fireside.run"
	name := strings.Split(subdomain, ".")[0]

	body := fmt.Sprintf(`{"name":"%s","instance_id":"%s"}`, name, instanceID)
	resp, err := http.Post(registrationAPI+"/heartbeat", "application/json", strings.NewReader(body))
	if err != nil {
		log.Printf("Tunnel heartbeat failed: %v", err)
		return
	}
	resp.Body.Close()
}

// handleTunnelCheck proxies a name availability check to the registration Worker.
func handleTunnelCheck() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}

		body := fmt.Sprintf(`{"name":"%s"}`, req.Name)
		resp, err := http.Post(registrationAPI+"/check", "application/json", strings.NewReader(body))
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "registration service unreachable"})
			return
		}
		defer resp.Body.Close()

		var result map[string]any
		json.NewDecoder(resp.Body).Decode(&result)
		writeJSON(w, resp.StatusCode, result)
	}
}

// handleTunnelClaim claims a name.fireside.run subdomain via the registration Worker.
// On success, it stores the tunnel credentials and triggers a hot-swap from Quick→Named tunnel.
func handleTunnelClaim(db *DB, onClaimed func()) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}

		instanceID, _ := db.GetConfig("instance_id")
		if instanceID == "" {
			// Generate a unique instance ID on first claim
			id, err := randomURLSafe(32)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to generate instance ID"})
				return
			}
			instanceID = id
			db.SetConfig("instance_id", instanceID)
		}

		body := fmt.Sprintf(`{"name":"%s","instance_id":"%s"}`, req.Name, instanceID)
		resp, err := http.Post(registrationAPI+"/claim", "application/json", strings.NewReader(body))
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "registration service unreachable"})
			return
		}
		defer resp.Body.Close()

		var result map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "invalid response from registration service"})
			return
		}

		if resp.StatusCode != http.StatusCreated {
			writeJSON(w, resp.StatusCode, result)
			return
		}

		// Store credentials in DB
		if token, ok := result["tunnel_token"].(string); ok {
			db.SetConfig("tunnel_token", token)
		}
		if subdomain, ok := result["subdomain"].(string); ok {
			db.SetConfig("tunnel_subdomain", subdomain)
			db.SetConfig("tunnel_url", "https://"+subdomain)
		}

		// Trigger hot-swap from Quick Tunnel → Named Tunnel
		if onClaimed != nil {
			go onClaimed()
		}

		writeJSON(w, http.StatusCreated, result)
	}
}
