# Fireside — Detailed Design (Low-Level)

This document covers the implementation details for each component. For what the product IS, see [product-spec.md](./product-spec.md). For system architecture, see [architecture.md](./architecture.md). For build phases, see [tech-plan.md](./tech-plan.md).

> **Status:** This is a living document. Sections will be filled in and refined during Phase 0 (Foundation) and updated as implementation proceeds.

---

## SQLite Schema

```sql
-- Server configuration (key-value)
CREATE TABLE server_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Keys: server_name, server_id, setup_complete, tunnel_url, tunnel_id

-- User accounts
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,          -- bcrypt or argon2
    display_name TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    encryption_key BLOB NOT NULL,         -- per-user AES-256 key (32 bytes), copied from invite at signup
    invite_id INTEGER REFERENCES invite_links(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions (for web UI auth)
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,                  -- random 64-char hex
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Invite links
CREATE TABLE invite_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,           -- random URL-safe string
    encryption_key BLOB NOT NULL,         -- unique AES-256 key for this invite (32 bytes)
    created_by INTEGER NOT NULL REFERENCES users(id),
    max_uses INTEGER DEFAULT 1,          -- NULL = unlimited
    uses INTEGER DEFAULT 0,
    expires_at DATETIME,                 -- NULL = never expires
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Conversations
CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,                           -- auto-generated from first message, editable
    model TEXT NOT NULL,                  -- model name used (e.g., "qwen3:8b")
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Messages (stored encrypted)
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content_encrypted BLOB NOT NULL,     -- AES-GCM encrypted content
    content_iv BLOB NOT NULL,            -- initialization vector for this message
    token_count INTEGER,                 -- for usage tracking
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API keys
CREATE TABLE api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash TEXT UNIQUE NOT NULL,        -- hash of the key (we don't store plaintext)
    key_prefix TEXT NOT NULL,             -- first 8 chars for identification (e.g., "sk-abc123")
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT,                            -- user-friendly label
    rate_limit INTEGER DEFAULT 100,      -- requests per hour
    request_count INTEGER DEFAULT 0,
    last_used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_invite_links_token ON invite_links(token);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
```

---

## Authentication

### Password Hashing

- Algorithm: **bcrypt** (well-supported in Go via `golang.org/x/crypto/bcrypt`)
- Cost factor: 12 (good balance of speed and security for <100 users)
- On signup: `bcrypt.GenerateFromPassword([]byte(password), 12)`
- On login: `bcrypt.CompareHashAndPassword(hash, []byte(password))`

### Session Management

- Session ID: 64 random hex characters (`crypto/rand`)
- Stored in SQLite `sessions` table
- Sent to browser as HTTP cookie:
  ```
  Set-Cookie: session=<id>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000
  ```
- `HttpOnly` — JavaScript can't read the cookie (XSS protection)
- `Secure` — only sent over HTTPS
- `SameSite=Strict` — not sent with cross-origin requests (CSRF protection)
- Session lifetime: 30 days (Max-Age=2592000)
- Last-active timestamp updated on every request
- Expired sessions cleaned up on a background timer (every hour)

### Auth Middleware

Every request to a protected endpoint goes through:

```
1. Check for session cookie → validate against sessions table → set user context
2. If no valid session:
   a. Check for API key in Authorization header → validate against api_keys table → set user context
   b. If no valid key → return 401
3. If requesting admin endpoint → check user.is_admin → if not → return 403
```

---

## Invite Link Lifecycle

```
1. Host creates invite in admin dashboard
   → Server generates random token (24 URL-safe characters)
   → Server generates a UNIQUE 256-bit AES key for this invite (crypto/rand)
   → Stores invite in SQLite (token, encryption_key, max_uses, expires_at)
   → Returns full URL: https://abc123.fireside.dev/invite/<token>#key=<base64url-encoded-key>
   → The #key=... part is the encryption key — it's in the URL fragment
   → Each invite link has its own unique key

2. Host shares the URL (text, email, in person, etc.)
   → The full URL including the fragment is shared

3. Client clicks the link
   → Browser sends request to /invite/<token> (fragment NOT sent to server)
   → Server validates token: not expired, uses < max_uses
   → Server serves signup page
   → Browser JS captures the encryption key from window.location.hash
   → Browser stores key in IndexedDB

4. Client submits signup form
   → Server validates again (race condition protection)
   → Creates user with encryption_key copied from the invite_links row
   → Increments invite use count
   → Creates session, sets cookie
   → Redirects to chatbot

5. If invite is used up (uses >= max_uses) or expired
   → Server returns a clean error page: "This invite link has expired or already been used."

6. Multi-use invites: all users who sign up via the same invite link
   share the same encryption key. For maximum isolation, create
   single-use invites (max_uses=1). Host can create unlimited invites.
```

---

## Encryption Protocol

> **Terminology note:** This is not "end-to-end encryption" in the Signal/WhatsApp sense. The server must decrypt messages to pass them to the LLM. What we provide is **encrypted transport beyond TLS** — the encryption protects against intermediaries (Cloudflare, ISPs, our relay) reading traffic. The Host's server has the keys and can access message content. The trust model assumes you know and trust the Host.

### What the encryption protects against

| Threat | Protected? | How |
|---|---|---|
| Cloudflare reading traffic | ✅ Yes | AES-GCM encryption before it hits the tunnel |
| ISPs reading traffic | ✅ Yes | Encrypted at application layer |
| Our company reading traffic | ✅ Yes | We never have the keys |
| The Host reading messages | ❌ No | Server has per-user keys to process through LLM |
| Someone hacking Host's machine | ❌ No | Keys are on the machine |

### Per-User Keys

Each user gets their own unique AES-256 encryption key:

| Key | Where it lives | Purpose |
|---|---|---|
| **User's server-side key** | `users.encryption_key` column | Server uses this to decrypt incoming, encrypt outgoing for this specific user |
| **User's client-side key** | In the Client's browser (IndexedDB) | Browser uses this to encrypt outgoing, decrypt incoming |

These are symmetric keys — the same key is on both sides (shared secret), distributed via the invite link fragment. Each user's key is unique.

### Encryption Algorithm

- **AES-256-GCM** (Galois/Counter Mode)
- Key size: 256 bits (32 bytes)
- IV (nonce): 12 bytes, randomly generated per message
- Authentication tag: 128 bits (built into GCM)
- Implementation: Web Crypto API in browser, Go `crypto/aes` + `crypto/cipher` on server

### Message Format (Wire)

```json
{
  "encrypted": true,
  "iv": "<base64-encoded 12-byte IV>",
  "ciphertext": "<base64-encoded encrypted content>",
  "tag": "<included in ciphertext by GCM>"
}
```

For streaming (SSE), each chunk is individually encrypted:
```
data: {"encrypted":true,"iv":"...","ciphertext":"..."}

data: {"encrypted":true,"iv":"...","ciphertext":"..."}

data: [DONE]
```

### Key Exchange Flow (Per-User)

```
1. Host creates an invite link
2. Server generates a UNIQUE 256-bit key for this invite (crypto/rand)
3. Key is stored in invite_links.encryption_key
4. Key is appended to URL as fragment:
   https://abc123.fireside.dev/invite/x7k9m2#key=<base64url-encoded-key>
5. Client clicks link → browser captures fragment → stores in IndexedDB
6. Fragment is NEVER sent to the server (HTTP spec: fragments are client-only)
7. On signup, server copies the key from invite_links to users.encryption_key
8. Both sides now have the same key, unique to this user
9. If another user signs up, they get a different key from their own invite link
```

### Browser-Side Encryption (Web Crypto API)

```javascript
// Encrypt a message
async function encrypt(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  return { iv: btoa(iv), ciphertext: btoa(new Uint8Array(ciphertext)) };
}

// Decrypt a message
async function decrypt(ciphertextB64, ivB64, key) {
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}
```

### Server-Side Encryption (Go)

```go
// Decrypt incoming message
func Decrypt(ciphertext, iv, key []byte) ([]byte, error) {
    block, err := aes.NewCipher(key)
    if err != nil { return nil, err }
    aesGCM, err := cipher.NewGCM(block)
    if err != nil { return nil, err }
    return aesGCM.Open(nil, iv, ciphertext, nil)
}

// Encrypt outgoing response
func Encrypt(plaintext, key []byte) (ciphertext, iv []byte, err error) {
    block, err := aes.NewCipher(key)
    if err != nil { return nil, nil, err }
    aesGCM, err := cipher.NewGCM(block)
    if err != nil { return nil, nil, err }
    iv = make([]byte, aesGCM.NonceSize())
    if _, err := io.ReadFull(rand.Reader, iv); err != nil { return nil, nil, err }
    ciphertext = aesGCM.Seal(nil, iv, plaintext, nil)
    return ciphertext, iv, nil
}
```

---

## API Key System

### Key Format

- Generated key: `sk-` + 48 random URL-safe characters (e.g., `sk-a3b8d1b60b3b4b1a9c1a1a2b3c4d5e6f7a8b9c0d1e2f3a4`)
- Only shown once at creation time (like GitHub personal access tokens)
- Stored as SHA-256 hash in the database
- Prefix (`sk-a3b8d1b6`) stored separately for identification in the admin panel

### Rate Limiting

- Per-key, per-hour (configurable by Host, default: 100 requests/hour)
- Implemented with a sliding window counter in SQLite
- When limit exceeded: return `429 Too Many Requests` with `Retry-After` header

### Key Validation Flow

```
1. Extract key from Authorization header: "Bearer sk-..."
2. Hash the key with SHA-256
3. Look up hash in api_keys table
4. If not found → 401
5. If found → check rate limit
6. If rate limit exceeded → 429
7. Otherwise → set user context from key's user_id, proceed
```

---

## Data Storage Layout

```
~/.fireside/
├── data.db              # SQLite database (users, conversations, config)
├── config.yaml          # Server config (port, Ollama URL, tunnel settings)
├── cloudflared.yml      # Cloudflare Tunnel config (auto-generated)
└── logs/
    └── server.log       # Server logs (rotated)
```

---

## Chat Message Flow (Detailed)

```
1. Client types message, clicks send
2. Browser JS:
   a. Retrieve encryption key from IndexedDB
   b. Generate random 12-byte IV
   c. Encrypt message with AES-256-GCM
   d. POST /api/chat with body:
      {
        "conversation_id": 42,       // null for new conversation
        "model": "qwen3:8b",
        "message": {
          "encrypted": true,
          "iv": "<base64>",
          "ciphertext": "<base64>"
        }
      }
      Cookie: session=<session_id>

3. Go server:
   a. Auth middleware validates session → identifies user_id
   b. Look up user's encryption_key from users table
   c. Decrypt message using this user's key → plaintext
   d. If new conversation: create conversation row in SQLite
   e. Store user message in messages table (encrypted form with user's key)
   f. Build message history: load previous messages for this conversation, decrypt each with user's key
   g. Send to Ollama:
      POST http://localhost:11434/api/chat
      {
        "model": "qwen3:8b",
        "messages": [
          {"role": "user", "content": "..."},
          {"role": "assistant", "content": "..."},
          {"role": "user", "content": "<new message>"}
        ],
        "stream": true
      }
   g. Ollama streams tokens back
   h. For each token:
      - Encrypt the token chunk
      - Send as SSE: data: {"encrypted":true,"iv":"...","ciphertext":"..."}
   i. After stream complete:
      - Concatenate full response
      - Store assistant message in messages table (encrypted form)
      - Update conversation.updated_at

4. Browser JS:
   a. Receive SSE stream
   b. For each chunk: decrypt → append to displayed message
   c. After stream complete: update conversation sidebar (title, timestamp)
```

---

## Open Questions / Decision Log

**Resolved:**

- [x] Which chatbot UI approach? **Custom HTML/CSS/JS** — no framework, no fork, no build step. Simpler than forking NextChat (87k-star React app). Every line is ours, easy to debug and extend. Can upgrade to a richer UI later if needed.
- [x] Go SQLite driver: **`modernc.org/sqlite`** (pure Go). No CGO = no C compiler needed, cross-compilation works out of the box, negligible performance difference at <100 users.
- [x] Encryption key design: **Per-user keys** — each invite generates a unique AES-256 key. Stored in `invite_links` and copied to `users` at signup. No shared key.
- [x] Message storage: **Plaintext for MLP** (encryption fields in schema are pre-wired for Phase 3). Encrypted storage comes with the encryption phase.
- [x] Conversation title generation: **Server-side, auto-generated** from first ~50 chars of first message.
- [x] Admin dashboard scope for MLP: **Full sidebar dashboard** with Overview, Models, Invites, Users, API Keys, Settings tabs. Premium feel, not a minimal admin page.
- [x] Admin dashboard access: **Auth-protected, accessible from any device** (not localhost-only). Same model as Plex, Jellyfin, Home Assistant. Login rate limiting for brute force protection.
- [x] API key ownership: **Host-only**. Clients who need API access receive keys from the Host directly.
- [x] API format: **OpenAI-compatible** (not Ollama format). Maximizes tool compatibility.
- [x] Default port: **7654** (avoids conflicts with React/3000, Flask/5000, Django/8000, Ollama/11434).

**Deferred to post-MLP:**

- [ ] Key rotation: per-user rotation without affecting other users.
- [ ] SDK streaming: how to handle streaming + encryption in the Python/Node SDK (each chunk needs its own IV).
- [ ] Password reset: Host should be able to reset a Client's password from admin panel.
