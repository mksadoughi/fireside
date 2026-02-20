# Fireside — Architecture (High-Level Design)

This document describes the system architecture — what components exist, how they connect, and how data flows through the system. For product requirements, see [product-spec.md](./product-spec.md). For implementation details, see [detailed-design.md](./detailed-design.md).

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        HOST'S MACHINE                               │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Go Binary (fireside)                       │   │
│  │                                                              │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐   │   │
│  │  │  HTTP Router │  │  Auth System │  │  Encryption Layer       │   │   │
│  │  │  & Middleware│  │  (Sessions,  │  │  (Decrypt inbound │   │   │
│  │  │             │  │   Invites,   │  │   Encrypt outbound)│   │   │
│  │  │             │  │   API Keys)  │  │                   │   │   │
│  │  └──────┬──────┘  └──────┬───────┘  └────────┬──────────┘   │   │
│  │         │                │                    │              │   │
│  │  ┌──────┴────────────────┴────────────────────┴──────────┐   │   │
│  │  │                   Core Server Logic                    │   │   │
│  │  │  - Chat handler (proxy to Ollama)                     │   │   │
│  │  │  - Admin API (users, models, invites, keys)           │   │   │
│  │  │  - Setup wizard                                       │   │   │
│  │  │  - OpenAI-compatible API (/v1/chat/completions)       │   │   │
│  │  └──────┬──────────────────────────────────┬─────────────┘   │   │
│  │         │                                  │                 │   │
│  │  ┌──────┴──────┐                    ┌──────┴──────┐          │   │
│  │  │   SQLite    │                    │  Embedded   │          │   │
│  │  │  (users,    │                    │  Chat UI    │          │   │
│  │  │  messages,  │                    │  (HTML/CSS/ │          │   │
│  │  │  config...) │                    │   JS files) │          │   │
│  │  └─────────────┘                    └─────────────┘          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                          │                                          │
│  ┌───────────────────────┴──────────────────────────────────────┐   │
│  │                      Ollama                                   │   │
│  │  (Model runtime: downloads, GPU detection, inference)         │   │
│  │  Listens on localhost:11434                                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                          │                                          │
│  ┌───────────────────────┴──────────────────────────────────────┐   │
│  │                    cloudflared                                 │   │
│  │  (Outbound tunnel to Cloudflare edge)                         │   │
│  │  Maps localhost:7654 → abc123.fireside.dev                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ Outbound WebSocket (no inbound ports needed)
         ▼
┌─────────────────────────┐
│   Cloudflare Edge       │
│   (TLS termination,     │
│    encrypted payload  │
│    means they only see   │
│    opaque blobs)               │
└────────────┬────────────┘
             │ HTTPS
             ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│   Client Browser        │         │   Developer Tool        │
│   (Chat UI + Encryption JS)   │         │   (curl / Python SDK)   │
│   Encrypts before send  │         │   Direct or SDK mode    │
│   Decrypts after receive│         │                         │
└─────────────────────────┘         └─────────────────────────┘
```

---

## Components

### 1. Go Binary (`fireside`)

The single executable that IS the product. Contains:

| Sub-component | Responsibility |
|---|---|
| **HTTP Router** | Routes requests to the right handler. Serves UI, API, admin, and setup wizard. |
| **Auth Middleware** | Checks session cookies (web UI) or API keys (API). Rejects unauthorized requests. |
| **Encryption Layer** | Decrypts incoming encrypted messages, encrypts outgoing responses. Sits between the router and Ollama proxy. |
| **Ollama Proxy** | Forwards chat requests to Ollama's local API (`localhost:11434`). Handles streaming SSE responses. |
| **User/Invite Manager** | CRUD operations for users, invite links, sessions. |
| **API Key Manager** | Generate, validate, revoke API keys. Rate limiting. |
| **Model Manager** | List, pull, delete models via Ollama API. Detect hardware. |
| **Admin API** | Endpoints for the admin dashboard (users, models, invites, keys, status). |
| **Setup Wizard** | First-run flow: hardware detection, model selection, admin creation, tunnel setup. |
| **Embedded UI** | Static HTML/CSS/JS files compiled into the binary via Go's `embed` package. |
| **Tunnel Manager** | Creates and manages the Cloudflare Tunnel via cloudflared CLI. |

### 2. Ollama

External dependency (installed separately). Runs as a background service on `localhost:11434`.

**We talk to it via its HTTP API:**
- `GET /api/tags` — list loaded models
- `POST /api/pull` — download a model
- `DELETE /api/delete` — remove a model
- `POST /api/chat` — chat completion (streaming)
- `POST /v1/chat/completions` — OpenAI-compatible endpoint
- `GET /api/ps` — running models and resource usage

**We do NOT modify Ollama.** We treat it as a black box.

### 3. cloudflared

External dependency (installed separately). Creates an outbound tunnel from the Host's machine to Cloudflare's edge network.

**We interact with it by:**
- Running `cloudflared tunnel create <name>` to create a tunnel
- Running `cloudflared tunnel route dns <tunnel-id> <subdomain>` to assign DNS
- Writing a config file that maps `localhost:7654` to the tunnel
- Starting it as a background service

### 4. SQLite Database

Embedded in the Go binary (via `modernc.org/sqlite` — pure Go, no CGO). Single file on disk (`~/.fireside/data.db`).

Tables: see [detailed-design.md](./detailed-design.md) for full schema.

### 5. Chat UI (Embedded)

A custom frontend (HTML/CSS/vanilla JS — no framework) compiled into the Go binary via `embed`. Served as static files.

**UI talks to the Go server via:**
- `POST /api/auth/login` — login
- `POST /api/auth/register` — signup (with invite token)
- `POST /api/auth/logout` — logout
- `GET /api/conversations` — list conversations
- `POST /api/chat` — send message (streaming SSE response)
- `GET /api/models` — list available models
- `PUT /api/settings` — update user settings
- `DELETE /api/conversations/:id` — delete conversation

All requests include the session cookie. All message payloads are encrypted with the user's per-user key.

### 6. Python/Node SDK

Thin client libraries that wrap the standard OpenAI client:
- Add AES-GCM encryption before sending
- Add decryption after receiving
- Same API surface as OpenAI SDK, just with an `encryption_key` parameter

---

## Data Flow

### Flow 1: Host Setup (first run)

```
Host runs install script
  → Script installs: Go binary, Ollama, cloudflared
  → Script starts Go binary
  → Go binary detects first run (no data.db)
  → Serves setup wizard at localhost:7654/#/setup
  → Host completes wizard:
      1. Hardware detection (calls Ollama API for GPU info)
      2. Model selection (calls Ollama pull)
      3. Admin account creation (writes to SQLite)
      4. Server naming (writes to SQLite)
      5. Tunnel creation (calls cloudflared CLI)
  → Wizard complete → redirect to admin dashboard
```

### Flow 2: Client Signup (via invite link)

```
Host creates invite link in admin dashboard
  → Server generates token + UNIQUE encryption key for this invite
  → Stores both in SQLite (invite_links table)
  → URL: https://abc123.fireside.dev/invite/x7k9m2#key=<base64url-encoded-key>

Client clicks link
  → Browser hits Cloudflare → tunnel → Go server
  → Server validates invite token
  → Serves signup page (server name, username/password fields)
  → Browser captures encryption key from URL fragment (never sent to server)
  → Browser stores encryption key in IndexedDB

Client submits signup form
  → Server: validates token not expired/used, hashes password
  → Server: creates user in SQLite with encryption_key copied from invite_links row
  → Server: increments invite use count
  → Server: creates session, sets cookie
  → Redirects to chatbot UI
```

### Flow 3: Client Sends a Chat Message (Encrypted)

```
Client types message in browser
  → Browser JS: encrypt message with AES-GCM using stored per-user key
  → Browser JS: send encrypted blob via POST /api/chat
  → Request includes session cookie + encrypted payload

Cloudflare edge receives request
  → Terminates TLS (but payload is encrypted blob — unreadable)
  → Forwards through tunnel to Host's Go server

Go server receives request
  → Auth middleware: validate session cookie → identify user_id
  → Encryption layer: look up this user's encryption_key from users table
  → Encryption layer: decrypt message using this user's key
  → Ollama proxy: forward plaintext to Ollama API (localhost:11434)
  → Ollama: runs inference, streams tokens back
  → Encryption layer: encrypt each token/chunk with this user's key
  → Stream encrypted chunks back to browser via SSE

Browser receives encrypted SSE stream
  → Browser JS: decrypt each chunk with the user's key
  → Render plaintext tokens in the chat UI (streaming display)

Server also:
  → Stores encrypted message + response in SQLite (messages table)
  → Messages stored encrypted with the user's key
```

### Flow 4: API Call (Direct mode, no encryption)

```
Developer sends request:
  curl https://abc123.fireside.dev/v1/chat/completions \
    -H "Authorization: Bearer sk-..." \
    -d '{"messages": [...]}'

Cloudflare edge → tunnel → Go server
  → Auth middleware: validate API key → identify user_id
  → Check rate limit for this key
  → Forward to Ollama API (plaintext — no application-layer encryption in direct mode)
  → Stream response back
  → Log usage to SQLite
```

### Flow 5: API Call (SDK mode, with encryption)

```
Developer uses SDK:
  from fireside import Fireside
  client = Fireside(url="...", api_key="sk-...", encryption_key="ek-...")
  client.chat("hello")

SDK:
  → Encrypt "hello" with AES-GCM using developer's per-user key
  → Send encrypted blob to /v1/chat/completions with API key header

Go server:
  → Auth middleware: validate API key → identify user_id
  → Encryption layer: look up this user's encryption_key
  → Decrypt message
  → Forward to Ollama
  → Encrypt response with this user's key
  → Return encrypted response

SDK:
  → Decrypt response with developer's key
  → Return plaintext to developer
```

---

## API Contracts

### Go Server ↔ Ollama

The Go server is a client of Ollama's HTTP API. Ollama runs on `localhost:11434`.

| Our action | Ollama endpoint | Method |
|---|---|---|
| Chat completion | `/api/chat` | POST (streaming) |
| OpenAI-compatible chat | `/v1/chat/completions` | POST |
| List models | `/api/tags` | GET |
| Pull model | `/api/pull` | POST |
| Delete model | `/api/delete` | DELETE |
| Running models | `/api/ps` | GET |
| Model info | `/api/show` | POST |

### Go Server ↔ Chat UI (Browser)

The Chat UI is a frontend app. It talks to the Go server via these endpoints:

**Auth:**
| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/auth/register` | POST | Invite token | Create account |
| `/api/auth/login` | POST | None | Login, receive session cookie |
| `/api/auth/logout` | POST | Session | End session |

**Chat:**
| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/chat` | POST | Session | Send message, receive streaming response (SSE) |
| `/api/conversations` | GET | Session | List user's conversations |
| `/api/conversations/:id` | GET | Session | Get messages in a conversation |
| `/api/conversations/:id` | DELETE | Session | Delete a conversation |

**User settings:**
| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/settings` | GET | Session | Get user settings |
| `/api/settings` | PUT | Session | Update settings (display name, password) |
| `/api/settings/export` | GET | Session | Export all user data |
| `/api/settings/account` | DELETE | Session | Delete account and all data |

**Models:**
| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/models` | GET | Session | List available models |

**Admin (Host only):**
| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/admin/users` | GET | Admin session | List all users |
| `/api/admin/users/:id` | DELETE | Admin session | Delete user |
| `/api/admin/invites` | GET | Admin session | List invite links |
| `/api/admin/invites` | POST | Admin session | Create invite link |
| `/api/admin/invites/:id` | DELETE | Admin session | Revoke invite link |
| `/api/admin/models` | GET | Admin session | List models with details |
| `/api/admin/models/pull` | POST | Admin session | Pull a new model |
| `/api/admin/models/:name` | DELETE | Admin session | Delete a model |
| `/api/admin/keys` | GET | Admin session | List all API keys |
| `/api/admin/keys` | POST | Admin session | Create API key |
| `/api/admin/keys/:id` | DELETE | Admin session | Revoke API key |
| `/api/admin/status` | GET | Admin session | Server status (GPU, memory, uptime, connections) |

### Go Server ↔ External API (Developers)

OpenAI-compatible. Authenticated with API keys.

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/v1/chat/completions` | POST | API key | Chat completion (streaming and non-streaming) |
| `/v1/models` | GET | API key | List available models |

---

## Deployment Topology

```
┌─── Host's Machine ────────────────────────────────┐
│                                                    │
│  fireside (Go binary)  ←→  Ollama (localhost:11434)│
│       ↕                                            │
│  cloudflared ──outbound──→ Cloudflare Edge         │
│                                                    │
│  ~/.fireside/                                      │
│  ├── data.db          (SQLite database)             │
│  ├── config.yaml      (server config)               │
│  └── cloudflared.yml  (tunnel config)               │
│                                                    │
└────────────────────────────────────────────────────┘

No inbound ports opened. No static IP needed.
All connections are outbound from the Host's machine.
```

---

## Security Boundaries

| Boundary | What's protected | How |
|---|---|---|
| **Client ↔ Cloudflare** | Transport | TLS (standard HTTPS) |
| **Client ↔ Host server** | Content from intermediaries | AES-256-GCM encryption (per-user key from invite link fragment) |
| **Cloudflare edge** | Can't read message content | Application-layer encryption — only sees encrypted blobs |
| **Host server ↔ Ollama** | Localhost only | Ollama binds to 127.0.0.1, not exposed externally |
| **SQLite data at rest** | Conversation content | Messages stored encrypted with per-user keys |
| **Admin dashboard** | Host-only access | Auth-protected (session + admin role check), accessible from any device via tunnel. Login rate limiting prevents brute force. |

---

## What We (the company) Run

| Service | Purpose | Infrastructure |
|---|---|---|
| DNS for `*.fireside.dev` | Route subdomains to tunnels | Cloudflare DNS (free) or thin API on a VPS |
| `fireside.dev` website | Landing page + install script | Static site (Vercel/GitHub Pages, free) |
| Package registry | Python/Node SDK distribution | PyPI + npm (free) |

We do NOT run compute, store user data, or process any chat traffic. The Host's machine does everything.
