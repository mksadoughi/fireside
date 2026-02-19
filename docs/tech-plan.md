# Fireside — Tech Plan

This document covers the technology choices and phased build plan for the MLP. For what the product IS and why it exists, see [product-spec.md](./product-spec.md). For system architecture, see [architecture.md](./architecture.md). For implementation details, see [detailed-design.md](./detailed-design.md).

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
- ~500-800 lines total. Every line is ours — easy to debug, easy to add encryption later.
- Embedded in the Go binary as static files via Go's `embed` package.
- The UI needs to look good. This is where the "hero factor" lives. If it looks like a hobby project, the Host won't share it.
- If the product gains traction, we can invest in a richer UI (React, NextChat fork, etc.) later. For MLP, clean and functional beats complex and polished.

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
- Python/Node SDK wraps encrypt/decrypt for API users.

The entire product is: **one Go binary + Ollama + cloudflared**. Three dependencies. One install command. No Node.js, no npm, no build pipeline for the frontend.

---

## Build Plan

### Phase 0: Foundation

Before writing any product code. Get the project scaffolding and design in place.

**Deliverables:**
- Repository setup (monorepo: `/server`, `/ui`, `/sdk`, `/website`, `/docs`)
- System architecture document — component diagram, data flow, API contracts between server ↔ Ollama, server ↔ UI, server ↔ cloudflared
- SQLite schema design — tables for users, sessions, conversations, messages, invite_links, api_keys, models, server_config
- Encryption protocol design — per-user key generation, key exchange mechanism, encryption algorithm choices, message format spec
- Auth flow design — invite link → signup → login → session lifecycle
- ~~Decision: which open-source chatbot UI to fork~~ **Decided: NextChat** (see [research/chat-ui-comparison.md](./research/chat-ui-comparison.md))
- Development environment: Go toolchain, Ollama running locally, cloudflared running locally

**Output:** [architecture.md](./architecture.md) and [detailed-design.md](./detailed-design.md) are complete. Ready to code.

---

### Phase 1: Core Server

The Go binary that wraps Ollama and manages everything. No UI yet — just the backend with API endpoints.

**Deliverables:**
- Go HTTP server with routing
- Ollama integration — proxy requests to Ollama API, list/pull/delete models, detect hardware (GPU, VRAM, RAM)
- SQLite database — create/migrate schema, CRUD operations for all tables
- User auth — bcrypt password hashing, session cookies, middleware for protected routes
- Invite system — generate invite links (one-time, limited-use, expiry), validate and consume tokens
- Admin endpoints — create/delete users, manage invites, manage models, view server status
- API key system — generate, validate, revoke keys, tie to user accounts, rate limiting
- OpenAI-compatible API — `/v1/chat/completions` endpoint (streaming and non-streaming), authenticated with API keys
- Basic tests for each component

**Milestone:** You can `curl` the server, authenticate with an API key, and get a chat response from Ollama. Admin can create invite links, manage users, and manage models via `curl`. No UI yet, but every backend feature is testable from the terminal.

---

### Phase 2: Chat UI

The thing Clients actually see and use. This is the product.

**Deliverables:**
- Custom chat UI — clean HTML + CSS + vanilla JavaScript, no framework
- Login page, signup page (via invite link), session handling
- Chat interface — message input, streaming responses (SSE), message history per conversation
- Conversation sidebar — list of past conversations, new chat, delete conversation
- Model picker dropdown (if Host has multiple models)
- Settings page — change password, change display name, delete conversations, export history, delete account
- Trust indicator — "Private AI · Hosted by [server name]" footer
- Offline page — clean "server is offline" message, auto-reconnect
- Mobile-responsive design (phone and tablet)
- Minimal admin page — create invite links, view users, manage models (also accessible via curl/API from Phase 1)
- Embed all UI assets into Go binary using Go's `embed` package
- Dark mode support
- Polish — the UI must look clean and trustworthy. This is where the Host's "hero factor" lives.

**Milestone:** A Host can open `localhost:3000`, log in, and chat. Admin can manage users and invites from the browser. Clients can't reach it remotely yet.

---

### Phase 3: Encryption

Application-layer encryption so Cloudflare (and later the relay) can't read traffic.

**Deliverables:**
- Encryption protocol implementation in the chat UI's JavaScript (Web Crypto API, AES-GCM)
- Per-user key generation — each invite link generates a unique 256-bit AES key
- Key stored in `invite_links.encryption_key`, copied to `users.encryption_key` at signup
- Key exchange mechanism — encryption key embedded in invite link URL fragment (`#key=...`)
- Client-side: encrypt every outgoing message before sending, decrypt every incoming response after receiving
- Server-side: look up user's key, decrypt incoming message to pass to Ollama, encrypt response before sending back
- Key storage in browser (IndexedDB, after first capture from URL fragment)
- Verify: open browser DevTools → Network tab → confirm all payloads are encrypted blobs
- Python SDK (`pip install fireside`) — thin wrapper around OpenAI client with encrypt/decrypt
- Node SDK (`npm install fireside`) — same, for JavaScript developers
- Published encryption protocol spec document (for independent security review)

**Milestone:** All chatbot traffic is encrypted at the application layer. Cloudflare sees gibberish. Each user has their own key. API users can choose direct (HTTPS only) or SDK (encrypted) mode.

---

### Phase 4: Networking & Install

Make it reachable from the internet and installable with one command.

**Deliverables:**
- Cloudflare Tunnel automation:
  - **MLP default:** `cloudflared tunnel --url http://localhost:3000` (trycloudflare — instant, random URL, no account needed)
  - **Post-MLP upgrade:** `fireside tunnel setup` guides Host through named tunnel with persistent `*.fireside.dev` subdomain (requires Cloudflare account + domain ownership)
- DNS routing — `abc123.fireside.dev` maps to the named tunnel via CNAME (via Cloudflare API or our thin DNS service)
- Install script (`curl -fsSL https://fireside.dev/install | sh`):
  - Detect OS (Linux, macOS, Windows via WSL)
  - Detect GPU vendor and VRAM
  - Install Ollama if not present
  - Install cloudflared if not present
  - Download the Go binary (pre-compiled for the platform)
  - Register as system service (auto-start on boot)
  - Start the server, open browser to setup wizard
- Setup wizard (served by the Go binary at `localhost:3000/setup`):
  - Hardware detection display
  - Model selection (recommended + custom)
  - Admin account creation
  - Server naming
  - Tunnel creation + URL display
- Host admin dashboard (at `localhost:3000/admin`):
  - User management, invite links, model management, API keys, server status

**Milestone:** A Host can run one command on a fresh machine and have a working, internet-accessible AI server within 10 minutes.

---

### Phase 5: Website & Documentation

The public face. How people find the product and learn to use it.

**Deliverables:**
- `fireside.dev` website (static site — Vercel, Netlify, or GitHub Pages):
  - Landing page — what is Fireside, why it exists, who it's for
  - Install instructions — one command, supported platforms
  - Hardware guide — what GPU you need, recommended models
  - FAQ — pulled from product-spec
  - Privacy page — how encryption works, published protocol spec
- Documentation site (can be same site or separate):
  - Host guide — install, setup, manage users, manage models, troubleshooting
  - Client guide — signing up, chatting, settings, multi-device
  - API documentation — endpoints, authentication, rate limits
  - SDK documentation — Python and Node, with encryption examples
- README for the repository (whether or not it's open source — needed for development)

---

### Phase 6: Testing & Launch

Real users, real feedback, real bugs.

**Deliverables:**
- Test with 5 real Hosts (diverse hardware: RTX 3060, RTX 4090, Mac Mini M4, older GPU, etc.)
- Test with their real families/friends as Clients
- Cross-platform testing — Linux, macOS, Windows (WSL)
- Mobile browser testing — iOS Safari, Android Chrome
- Edge case testing — server restart, network loss, concurrent users, model switching mid-chat, invite link edge cases
- Fix everything that breaks
- Post to: r/selfhosted, r/LocalLLaMA, Hacker News
- Gather feedback, prioritize V2 features

---

## Success Criteria

The MLP works if:
- A Host can go from zero to shareable URL in under 10 minutes
- A Client can go from invite link to chatting in under 1 minute
- At least 3 out of 5 test Clients use it more than once in the first week
- The Host doesn't need to touch anything after initial setup
- At least 1 developer successfully connects to the API and makes a request
- Encryption is verifiable — encrypted blobs visible in browser DevTools, each user has a unique key
