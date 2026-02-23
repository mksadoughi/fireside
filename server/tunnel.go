package main

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log"
	"os/exec"
	"regexp"
	"time"
)

// TunnelProvider abstracts the networking layer that makes the server publicly reachable.
// V1 implements CloudflareTunnelProvider. V2 will implement FiresideRelayProvider.
// Auth, chat, encryption, and API are networking-agnostic — only startup orchestration changes.
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

// --- CloudflareTunnelProvider ---

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

		log.Printf("Tunnel: starting cloudflared...")
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
		"http://localhost:"+itoa(p.port))

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

	// Scan output for the trycloudflare URL in a separate goroutine
	go func() {
		scanner := bufio.NewScanner(pr)
		for scanner.Scan() {
			line := scanner.Text()
			if m := trycloudflareRe.FindString(line); m != "" {
				select {
				case urlCh <- m:
					log.Printf("Tunnel: URL captured: %s", m)
				default:
					// Receiver not ready yet; skip — URL will update on next reconnect
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

// itoa converts an int to a string without importing strconv at the package level.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	buf := [20]byte{}
	pos := len(buf)
	for n > 0 {
		pos--
		buf[pos] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[pos:])
}

// --- NamedTunnelProvider ---

// NamedTunnelProvider runs a Cloudflare Named Tunnel using credentials claimed
// from api.fireside.run during first-run setup. The host gets a permanent
// name.fireside.run subdomain that never changes on restart.
//
// Credentials are stored in the DB:
//   tunnel_token     — cloudflared tunnel token (from our registration Worker)
//   tunnel_subdomain — e.g. "alice.fireside.run"
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

		log.Printf("Tunnel: starting named tunnel for %s...", p.subdomain)
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
