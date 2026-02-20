# Fireside — Tech Plan

This document covers the technology choices and phased build plan for the MLP. For what the product IS and why it exists, see [product-spec.md](./product-spec.md). For system architecture, see [architecture.md](./architecture.md). For implementation details, see [detailed-design.md](./detailed-design.md). For UI/UX design, see [ux-spec.md](./ux-spec.md).

**Important:** Phase numbers are for incremental development only. ALL phases must be complete before MLP ships. We are not launching a half-made product.

---

## Tech Stack

**Server: Go**
- Compiles to a single binary. No runtime dependencies.
- Good networking and concurrency.
- Cross-platform (Linux, macOS, Windows).
- Wraps Ollama's API, adds user auth and invite system, serves the chat UI, manages Cloudflare Tunnel.

**Chat UI: Custom (HTML/CSS/JS)**
- Lightweight custom chat interface — no framework, no React, no build step.
- Clean HTML + CSS + vanilla JavaScript. Chat bubbles, text input, streaming text, conversation sidebar, dark mode.
- Embedded in the Go binary as static files via Go's `embed` package.
- The UI needs to look good. This is where the "hero factor" lives. If it looks like a hobby project, the Host won't share it.

**Storage: SQLite**
- Zero config, embedded in the Go binary.
- Stores: user accounts, invite links, chat history, API keys, server config.

**Model runtime: Ollama**
- Handles model downloads, GPU detection, quantization, inference.
- The server talks to Ollama's local API.
- Install script installs Ollama if not already present.

**Networking: Cloudflare Tunnel (cloudflared)**
- Free, reliable.
- Install script installs cloudflared and configures the tunnel automatically.

**Encryption: Web Crypto API + AES-GCM**
- Built into all modern browsers, hardware-accelerated.
- Per-user key exchange via invite link URL fragment.
- Each invite generates a unique 256-bit key; per-user isolation.
- Encryption ships from day one — it IS the product's core promise.

The entire product is: **one Go binary + Ollama + cloudflared**. Three dependencies. One install command. No Node.js, no npm, no build pipeline for the frontend.

---

## Build Plan

Legend: ✅ done | 🔧 partially done | ❌ not started | 📝 needs update per recent decisions

---

### Phase 0: Foundation

Before writing any product code. Get the project scaffolding and design in place.

**Deliverables:**
- ✅ Repository setup (monorepo: `/server`, `/ui`, `/docs`)
- ✅ System architecture document ([architecture.md](./architecture.md))
- ✅ SQLite schema design ([detailed-design.md](./detailed-design.md))
- ✅ Encryption protocol design ([detailed-design.md](./detailed-design.md))
- ✅ Auth flow design (invite link → signup → login → session lifecycle)
- ✅ UI decision: Custom vanilla HTML/CSS/JS
- ✅ UX specification ([ux-spec.md](./ux-spec.md))
- ✅ Development environment: Go toolchain, Ollama running locally

**Status: COMPLETE**

---

### Phase 1: Core Server

The Go binary that wraps Ollama and manages everything.

**Deliverables:**
- ✅ Go HTTP server with routing (`main.go`)
- 🔧 Ollama integration:
  - ✅ List models (`GET /api/tags` proxy)
  - ✅ Chat — non-streaming (`ollama.Chat()`)
  - ✅ Chat — streaming SSE (`ollama.ChatStream()`)
  - ❌ Pull/download model (need `POST /api/pull` proxy with streaming progress)
  - ❌ Delete model (need `DELETE /api/delete` proxy)
  - ❌ Running models / hardware info (need `GET /api/ps` proxy)
- ✅ SQLite database — schema, migrations, CRUD (`database.go`)
- ✅ User auth — bcrypt, sessions, cookies, middleware (`auth.go`)
- ✅ Invite system — create, validate, consume, list, delete (`invites.go`)
- ✅ User registration via invite token (`handleRegister`)
- 🔧 Admin endpoints:
  - ✅ Manage invites (create, list, delete)
  - ✅ List users
  - ❌ Delete/disable users
  - ❌ Manage models (pull, delete via API)
  - ❌ Server status endpoint (uptime, active sessions, model count, message count)
- ✅ API key system — create, validate (SHA-256), revoke, list (`apikeys.go`)
  - ❌ Rate limiting (DB field exists, not enforced)
- ✅ OpenAI-compatible API (`openai.go`):
  - ✅ `POST /v1/chat/completions` (streaming + non-streaming)
  - ✅ `GET /v1/models`
- ❌ Login rate limiting (brute force protection — critical for auth-exposed dashboard)
- ❌ Basic tests

**Milestone:** You can `curl` the server, authenticate with an API key, and get a chat response from Ollama. Admin can create invite links, manage users, and manage models via `curl`.

---

### Phase 2: Chat UI & Dashboard

The thing Clients actually see and use. This is the product.

**Chat UI deliverables:**
- 🔧 Login page:
  - ✅ Login form with username/password
  - ❌ Server name displayed as heading (fetches after login, should show before)
  - ❌ "Need access? Ask the server admin for an invite link." note
- 🔧 Setup page (first-run):
  - ✅ Server name + username + password form
  - ❌ Confirm password field
  - ❌ Two-step wizard (Welcome → Create Server) per UX spec
- ❌ Invite registration page (`#/invite/:token`) — backend exists, NO UI
- ✅ Chat interface — message input, streaming responses (SSE), message display
- ✅ Conversation sidebar — list, new chat, delete, active highlight
- ✅ Model picker dropdown
- ✅ Mobile responsive (CSS media queries, sidebar toggle)
- ✅ Dark mode (default theme)
- ✅ Auto-resize textarea, Enter to send, Shift+Enter for newline
- ❌ Hash-based SPA routing (`#/setup`, `#/login`, `#/chat`, `#/dashboard`, `#/invite/:token`)
- ❌ Markdown rendering (bold, italic, headers, lists, links)
- ❌ Code blocks with syntax highlighting + copy button
- ❌ Suggested prompt buttons on welcome screen
- 🔧 Trust indicator footer — element exists, shows "Private AI" but not server name dynamically
- ❌ Offline page / auto-reconnect
- ❌ Settings page (change password, display name, delete conversations)
- ❌ Embed UI in Go binary via `embed` package (currently served from filesystem)

**Dashboard deliverables (admin only):**
- 🔧 Current state: centered container with 3 tabs (Invites, API Keys, Users)
- 📝 Needs: full sidebar layout per UX spec with 6 tabs
- ✅ Invites tab — create, list, revoke, copy URL
- ✅ API Keys tab — create, list, revoke, copy key
  - ❌ Usage examples shown after key creation (Python, Cursor, curl)
- ✅ Users tab — list with role badges
  - ❌ Delete/revoke user button
  - ❌ Last Active column
- ❌ Overview tab — getting started checklist + stats cards
- ❌ Models tab — list installed, download new, delete, progress bar, popular suggestions
- ❌ Settings tab — edit server name, change password, tunnel URL
- ❌ Sidebar navigation layout (Overview, Models, Invites, Users, API Keys, Settings)

**Milestone:** A Host can open `localhost:7654`, log in, manage their server from the dashboard, and chat. Clients can register via invite link and chat. Works on desktop and mobile.

---

### Phase 3: Encryption

Application-layer encryption so Cloudflare (and later the relay) can't read message content. This is the product's core privacy promise — it ships before launch, not as a future feature.

**Deliverables:**
- ❌ Browser-side: encrypt outgoing messages with Web Crypto API (AES-256-GCM)
- ❌ Browser-side: decrypt incoming streaming responses
- ❌ Server-side: decrypt incoming messages (look up user's per-user key)
- ❌ Server-side: encrypt outgoing responses before sending
- ❌ Per-user key exchange via invite link URL fragment (`#key=...`)
- ❌ Key storage in browser (IndexedDB)
- ✅ Schema pre-wired (encryption_key columns in invite_links and users tables)
- ✅ Encryption keys generated during invite creation and copied to users at signup
- ❌ Verify: DevTools → Network → all payloads are encrypted blobs
- ❌ Published encryption protocol spec

**NOT in MLP (deferred):**
- Python/Node SDK with encryption (MLP supports direct API mode only — HTTPS, no app-layer encryption for API calls)

**Milestone:** All chat traffic through Cloudflare is encrypted. Cloudflare sees gibberish. Each user has their own key. Verifiable in browser DevTools.

---

### Phase 4: Networking & Install

Make it reachable from the internet and installable with one command.

**Deliverables:**
- ❌ Cloudflare Tunnel automation:
  - **MLP default:** `cloudflared tunnel --url http://localhost:7654` (trycloudflare — instant, random URL)
  - **Post-MLP upgrade:** named tunnel with persistent subdomain
- ❌ Install script (`curl -fsSL https://getfireside.com/install | sh`):
  - Detect OS (Linux, macOS)
  - Install Ollama if not present
  - Install cloudflared if not present
  - Download pre-compiled Go binary
  - Register as system service (auto-start on boot)
  - Start server, open browser
- ❌ Cross-compile Go binary for all platforms (macOS ARM, macOS Intel, Linux x86, Linux ARM)
- ❌ Embed UI assets into Go binary via `embed` package

**Milestone:** A Host can run one command on a fresh machine and have a working, internet-accessible AI server within 10 minutes.

---

### Phase 5: Website & Documentation

The public face. How people find the product and learn to use it.

**Deliverables:**
- ❌ `getfireside.com` static site:
  - Landing page (hero, value props, API code snippet, download CTA)
  - Download page (auto-detect OS, GitHub Releases links)
  - Docs: Getting Started, API Guide, API Reference, FAQ
  - Privacy page (encryption protocol spec)
- ❌ Cloudflare Analytics or similar (privacy-respecting)
- 🔧 README — exists but basic

**Milestone:** Someone can find the project, understand what it does, download it, and read the API docs.

---

### Phase 6: Testing & Launch

Real users, real feedback, real bugs.

**Deliverables:**
- ❌ Test with real Hosts on diverse hardware
- ❌ Test with their real families/friends as Clients
- ❌ Cross-platform testing (Linux, macOS)
- ❌ Mobile browser testing (iOS Safari, Android Chrome)
- ❌ Edge case testing (server restart, network loss, concurrent users, model switching)
- ❌ Security audit of encryption implementation
- ❌ Post to: r/selfhosted, r/LocalLLaMA, Hacker News

---

## Progress Summary

| Phase | Status | Estimated completion |
|---|---|---|
| Phase 0: Foundation | ✅ Complete | Done |
| Phase 1: Core Server | ~75% done | Missing: model management, user delete, rate limiting, tests |
| Phase 2: Chat UI & Dashboard | ~30% done | Missing: routing, invite page, markdown, dashboard rebuild, models tab, settings |
| Phase 3: Encryption | ~5% (schema only) | All implementation needed |
| Phase 4: Networking & Install | Not started | All implementation needed |
| Phase 5: Website & Docs | Not started | All implementation needed |
| Phase 6: Testing & Launch | Not started | Depends on everything above |

---

## Success Criteria

The MLP works if:
- A Host can go from zero to shareable URL in under 10 minutes
- A Client can go from invite link to chatting in under 1 minute
- At least 3 out of 5 test Clients use it more than once in the first week
- The Host doesn't need to touch anything after initial setup
- At least 1 developer successfully connects to the API and makes a request
- Encryption is verifiable — encrypted blobs visible in browser DevTools, each user has a unique key
