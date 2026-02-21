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
- ✅ Ollama integration:
  - ✅ List models (`GET /api/tags` proxy)
  - ✅ Chat — non-streaming (`ollama.Chat()`)
  - ✅ Chat — streaming SSE (`ollama.ChatStream()`)
  - ✅ Pull/download model with streaming progress (`PullModelStream`)
  - ✅ Delete model (`DeleteModel`)
  - ✅ Running models (`ListRunningModels`)
- ✅ SQLite database — schema, migrations, CRUD (`database.go`)
- ✅ User auth — bcrypt, sessions, cookies, middleware (`auth.go`)
- ✅ Invite system — create, validate, consume, list, delete (`invites.go`)
- ✅ User registration via invite token (`handleRegister`)
- 🔧 Admin endpoints:
  - ✅ Manage invites (create, list, delete)
  - ✅ List users
  - ❌ Delete/disable users
  - ✅ Manage models (pull, delete, list running via API)
  - ✅ Server status endpoint (users, active sessions, model count, message count)
  - ✅ Server settings (get/update server name, tunnel URL)
  - ✅ Change password endpoint (admin only)
  - ❌ Client self-service password change (`PUT /api/auth/password` — any authenticated user)
  - ❌ Admin reset client password (`PUT /api/admin/users/{id}/password` — admin sets new password)
  - ❌ Reset server endpoint (wipe database, return to setup — **localhost only**, detect via `Cf-Connecting-IP` header)
- ✅ API key system — create, validate (SHA-256), revoke, list (`apikeys.go`)
  - ❌ Rate limiting (DB field exists, not enforced)
- ✅ OpenAI-compatible API (`openai.go`):
  - ✅ `POST /v1/chat/completions` (streaming + non-streaming)
  - ✅ `GET /v1/models`
- ❌ Login rate limiting (brute force protection — critical for auth-exposed dashboard)
- ❌ Basic tests

**Milestone:** You can `curl` the server, authenticate with an API key, and get a chat response from Ollama. Admin can create invite links, manage users, manage models, and configure settings via `curl`.

---

### Phase 2: Chat UI & Dashboard

The thing Clients actually see and use. This is the product.

**Chat UI deliverables:**
- ✅ Login page:
  - ✅ Login form with username/password
  - ✅ Server name displayed as heading
  - ✅ "Need access? Ask the server admin for an invite link." note
- 🔧 Setup page (first-run):
  - ✅ Server name + username + password form
  - ✅ Two-step wizard (Welcome → Create Server)
  - ❌ Confirm password field
- ✅ Invite registration page (`#/invite/:token`) — validate token, register, auto-login
- ✅ Chat interface — message input, streaming responses (SSE), message display
- ✅ Conversation sidebar — list, new chat, delete, active highlight
- ✅ Model picker dropdown
- ✅ Mobile responsive (CSS media queries, sidebar toggle)
- ✅ Dark mode (default theme)
- ✅ Auto-resize textarea, Enter to send, Shift+Enter for newline
- ✅ Hash-based SPA routing (`#/setup`, `#/login`, `#/chat`, `#/dashboard`, `#/invite/:token`)
- ❌ Markdown rendering (bold, italic, headers, lists, links)
- ❌ Code blocks with syntax highlighting + copy button
- ❌ Suggested prompt buttons on welcome screen
- 🔧 Trust indicator footer — element exists, shows "Private AI" but not server name dynamically
- ❌ Client password change (accessible from chat sidebar)
- ❌ Confirm password field on invite registration page
- ❌ Offline page / auto-reconnect
- ❌ Embed UI in Go binary via `embed` package (currently served from filesystem)

**Dashboard deliverables (admin only):**
- ✅ Sidebar navigation layout with section headers (Server / Interfaces)
- ✅ Overview tab — getting started checklist + stats cards (users, messages, models, sessions)
- ✅ Models tab — list installed, download new with progress bar, delete
  - ❌ Popular model suggestion cards
- ✅ Settings tab — edit server name, tunnel URL, change password
  - ❌ Reset Server button (localhost only — hidden when accessed remotely, requires password re-entry + confirmation)
- ✅ Chat tab (merged Users + Invites) — users list, single-use invite creation, pending invites
  - ✅ Subtle "Try it yourself →" link to chat UI
  - ✅ Single-use invites (one invite = one person)
  - ❌ Delete/revoke user button
  - ❌ Admin reset user password button + modal
  - ❌ Last Active column
- ✅ API tab — create keys, list active keys, revoke
  - ❌ Usage examples shown after key creation (Python, Cursor, curl)

**Milestone:** A Host can open `localhost:7654`, log in, manage their server from a sidebar dashboard (Server: Overview/Models/Settings, Interfaces: Chat/API), and chat. Clients can register via single-use invite link and chat. Works on desktop and mobile.

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

### Phase 7: Post-MLP (V2 Ideas)
Features that elevate the product but are not required for the initial launch.

**Deliverables:**
- ❌ Hardware detection (RAM, CPU, GPU) shown in Admin Dashboard
- ❌ Model size warnings (e.g. warning admin when downloading a 32B model on a 16GB RAM machine)
- ❌ Concurrency limits / Queueing (prevent 5 users from crashing the server simultaneously)

