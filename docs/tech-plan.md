# Fireside — Tech Plan

For what the product IS and why it exists, see [product-spec.md](./product-spec.md). For system architecture, see [architecture.md](./architecture.md). For implementation details, see [detailed-design.md](./detailed-design.md). For UI/UX design, see [ux-spec.md](./ux-spec.md).

---

## Tech Stack

**Server: Go** — single binary, no runtime dependencies, cross-platform. Handles auth, multi-user, chat history, Ollama proxy, networking (V1: Cloudflare Tunnel, V2: Fireside Relay).

**Chat UI: Custom HTML/CSS/JS** — embedded in the binary via `embed`. No framework, no build step. The reference client: proves the encrypted API works and is what non-technical users interact with. If it looks like a hobby project, the Host won't share it.

**Storage: SQLite** — zero config, embedded. Users, sessions, invites, chat history, API keys, server config, per-user encryption keys.

**Model runtime: Ollama** — handles model downloads, GPU detection, quantization, inference. Server talks to Ollama's local API.

**Encryption: AES-256-GCM (Web Crypto API)** — built into all modern browsers, hardware-accelerated. Per-user 256-bit keys generated at invite creation. Browser encrypts before the request leaves the device; server decrypts to process, re-encrypts to store.

**Networking (V1): Cloudflare Tunnel** — free, zero ops, instant public URL. V1 default.

**Networking (V2): Fireside Relay** — our operated service. Persistent subdomain, true end-to-end. The commercial tier. Replaces Cloudflare via a swappable interface in the binary (see V2 section).

The entire product is: **one Go binary + Ollama + cloudflared (V1)**. One install command. No Node.js, no npm, no build pipeline.

---

## Security Model

Understanding the exact guarantees avoids overstating or understating the product's privacy promise.

**What Fireside protects against:**
- Cloudflare (V1) and the Fireside relay (V2) seeing message content
- Messages being readable if the database is compromised (encrypted at rest)
- Per-user isolation — one user's key cannot decrypt another's messages

**What Fireside does not protect against:**
- The Host reading messages — the server decrypts to process them and holds the encryption keys. For family/friends use this is fine. Do not imply otherwise.
- The V1 API (OpenAI-compatible `/v1/` endpoints) is HTTPS-only. Cloudflare terminates TLS and can read plaintext API requests. This is documented and intentional — encrypting the `content` field of OpenAI JSON breaks every developer tool. V2 relay solves this without any client changes.
- Metadata: connection timing and data volumes are visible to relay operators regardless of content encryption.

**Key tradeoff documented:** Server-side key storage (required to reconstruct conversation history for Ollama) means the encryption key passes through Cloudflare on login. The "Cloudflare sees gibberish" guarantee applies to chat payloads, not the login exchange. Fully client-side-only keys would require clients to re-send full history on every message — impractical.

**Two-tier privacy (V1):**
| Interface | Who can read content |
|-----------|---------------------|
| Chat UI | Nobody except Host's server (AES-256-GCM through Cloudflare) |
| OpenAI API (`/v1/`) | Cloudflare + Host's server (HTTPS only) |

**Unified privacy (V2):**
| Interface | Who can read content |
|-----------|---------------------|
| Chat UI | Host's server only |
| OpenAI API (`/v1/`) | Host's server only |
| Open WebUI, Cursor, LangChain | Host's server only |

---

## Open Source & Business Model

**License: AGPL-3.0** — everything open source: server, Chat UI, relay client code, relay server code. For a privacy product, closed source is a contradiction. The community cannot trust what it cannot audit. AGPL specifically: any fork deployed as a service must open source modifications — closes the SaaS loophole.

**The moat is not the code.** It is: community trust, the `fireside.run` brand, operated relay infrastructure, and development velocity. Anyone can read the code. Very few can run a reliable relay service.

**Business model: Open core + managed service**

| | Free (self-hosted) | Paid — Fireside Connect (~$8-10/month) |
|--|--|--|
| Full Fireside server | ✅ | ✅ |
| Chat UI with AES-256-GCM encryption | ✅ | ✅ |
| OpenAI-compatible API | ✅ | ✅ |
| Multi-user invite system | ✅ | ✅ |
| Cloudflare Tunnel (random URL) | ✅ | ✅ |
| **Fireside Relay** (`name.fireside.run`) | ❌ | ✅ |
| **Persistent URL** (never changes on restart) | ❌ | ✅ |
| **True end-to-end** (relay cannot read content) | ❌ | ✅ |
| **API traffic fully private** | ❌ | ✅ |
| Uptime SLA | ❌ | ✅ |

We sell convenience and stronger guarantees — not safety. The free tier is genuinely private.

**Revenue math:** 500 paying hosts × $9/month = $4,500/month. Relay infrastructure at this scale: ~$20-30/month. Unit economics are strong.

**Known concern:** AGPL can be a blocker for enterprise adopters with blanket no-AGPL policies. If an enterprise tier becomes relevant, offer a commercial license alongside AGPL. Not a concern for the launch audience (privacy community, self-hosters, developers).

---

## V1: MLP

**Phases 0–4 are complete:** foundation, core server (auth, Ollama, API, admin), Chat UI and dashboard, AES-256-GCM encryption, Cloudflare Tunnel automation, install script, cross-platform build. The product works end-to-end and is publicly reachable.

**What remains:**

### Phase 4: Networking & Install

Make it publicly reachable and installable with one command. This phase establishes the `TunnelProvider` interface — the key architectural decision that makes V2 a drop-in replacement for Cloudflare without touching any other code.

- ✅ `TunnelProvider` interface in the binary — abstracts the networking layer. V1 implements `CloudflareTunnelProvider`. V2 implements `FiresideRelayProvider`. Auth, chat, encryption, and API are networking-agnostic.
- ✅ Cloudflare Tunnel automation:
  - Spawn `cloudflared tunnel --url http://localhost:7654` on startup
  - Capture public URL from cloudflared output, store in settings, surface in dashboard
- ✅ Install script (`curl -fsSL https://fireside.run/install | sh`):
  - Detect OS (Linux, macOS)
  - Install Ollama if not present
  - Install cloudflared if not present
  - Download pre-compiled Fireside binary
  - Register as system service (auto-start on boot)
  - Start server, open browser to setup page
- ✅ Cross-compile for all platforms: macOS ARM, macOS Intel, Linux x86, Linux ARM

**Platform note:** V1 targets macOS and Linux only. Windows support (binary works, install script doesn't) is a V1.x item — revisit when there's user demand.

**Milestone:** A Host runs one command on a fresh machine and has a working, internet-accessible AI server within 10 minutes.

---

### Phase 4b: Permanent `name.fireside.run` Subdomains

Every host gets a permanent `name.fireside.run` URL — survives restarts, shareable forever. Built on Cloudflare Named Tunnels (free infrastructure) with a small registration service we operate. The URL carries over unchanged when a host upgrades to V2.

**How it works:** Host picks a name during first-run setup → our registration Worker claims a Cloudflare Named Tunnel on our account and creates the DNS CNAME → host's local `cloudflared` runs with those credentials → `name.fireside.run` is live and permanent.

**Registration Worker** (`workers/` — Cloudflare Worker + KV, deployed to `api.fireside.run`):
- ✅ `POST /check` — check name availability (KV lookup), return suggestions if taken
- ✅ `POST /claim` — validate name, create Named Tunnel via Cloudflare API, write KV entry, add DNS CNAME, return tunnel credentials
- ✅ `POST /heartbeat` — extend name TTL (Fireside binary calls this daily)
- ✅ `POST /release` — delete tunnel + DNS CNAME + KV entry (called on clean uninstall)

**Security mitigations:**
- ✅ Rate limiting: max 3 claim attempts per IP per hour (Workers rate limiting API)
- ✅ Reserved names blocklist: `admin`, `api`, `www`, `app`, `install`, `relay`, `connect`, `status`, `dashboard`, `fireside`, `mail`, `blog`, `docs`, `support`, `billing` (and others)
- ✅ Scoped Cloudflare API token: only permissions to create/delete tunnels + manage DNS for `fireside.run` — not a root key, stored as encrypted Worker secret
- ✅ Heartbeat + 30-day expiry: name released automatically if no heartbeat for 30 days — prevents squatting and frees abandoned names
- ✅ Atomic cleanup: DNS CNAME deleted in the same operation as tunnel deletion — prevents dangling CNAME / subdomain takeover

**Fireside binary changes:**
- ✅ `NamedTunnelProvider` — new `TunnelProvider` implementation:
  - On first run: name picker flow (suggest name, real-time availability check, handle collisions with alternatives)
  - Stores tunnel credentials in DB after successful claim
  - Runs `cloudflared tunnel run <name>` with credentials — URL is `name.fireside.run` immediately and permanently
  - Heartbeat goroutine: pings `api.fireside.run/heartbeat` every 24 hours
- ✅ First-run setup wizard: add name picker step (host chooses their subdomain before server goes public)
- ✅ Dashboard: show permanent `name.fireside.run` URL — no "Connecting…" state, no URL changes on restart

**One-time infrastructure setup** (do once, on `fireside.run` domain):
- ✅ Add `fireside.run` to Cloudflare (DNS managed by Cloudflare — required for Named Tunnels to work)
- ✅ Create scoped API token with tunnel + DNS permissions
- ✅ Deploy registration Worker to `api.fireside.run`
- ✅ Create KV namespace and bind to Worker

**Milestone:** Host picks `alice.fireside.run` during setup. That URL never changes — not on restart, not ever. Clients bookmark it once and it always works.

---

### Phase 5: Website & Documentation

The public face. How people find Fireside and understand what it does.

- ❌ `fireside.run` static site:
  - Landing page: private AI server, one-command install, API-first with Chat UI included
  - Download page (auto-detect OS, links to GitHub Releases)
  - Docs: Getting Started, API Guide, Security Model (honest about the two tiers — critical for trust)
  - Privacy page: what Fireside can and cannot see, exact encryption guarantees
- ❌ README: complete, with install instructions, architecture overview, and API quickstart
- ❌ Analytics: privacy-respecting (no Google Analytics)

**Milestone:** Someone lands on the site, understands the product in 30 seconds, downloads it, and can start using the API within 5 minutes.

---

### Phase 6: Testing & Launch

Real users, real hardware, real bugs.

- ❌ Test with real Hosts on diverse hardware (laptop GPU, no GPU, desktop)
- ❌ End-to-end testing with real Clients (family/friends)
- ❌ Cross-platform: Linux, macOS, iOS Safari, Android Chrome
- ❌ Edge cases: server restart, network loss, concurrent users, model switching mid-conversation
- ❌ Security audit of encryption implementation
- ❌ Community launch: r/selfhosted, r/LocalLLaMA, Hacker News

**V1 Milestone:** Anyone can install Fireside in under 10 minutes, share it privately with family and friends via invite links, and have encrypted conversations. Developers can connect any OpenAI-compatible tool to the API. The product is complete and honest about what it does.

---

## V2: Fireside Connect

V2 is the commercial layer. It ships after V1 has demonstrated product-market fit. Architecturally it slots in through the `TunnelProvider` interface introduced in Phase 4 — no refactoring needed in auth, chat, encryption, or API.

**Core change:** The Fireside relay passes raw TCP without terminating TLS. TLS terminates at the host's Fireside server. The relay sees connection metadata (who connects, when, how much data) but never content. This makes the OpenAI API as private as the Chat UI, with zero changes to developer tools.

**Name continuity:** The `name.fireside.run` subdomain claimed in Phase 4b carries over to V2 unchanged. The registration Worker swaps the DNS target from a Cloudflare Named Tunnel CNAME to our relay IP — the host's URL never changes. Clients notice nothing.

### What needs to be built

**Relay Server** (new service, runs on our infrastructure):
- SNI-based TCP router: reads TLS ClientHello to extract hostname, routes to correct Fireside instance without decrypting
- Registration API: Fireside instances connect, authenticate, and claim a subdomain
- Tunnel multiplexer: maintains persistent outbound connections from Fireside instances (behind NAT), multiplexes client connections through them (yamux)
- DNS: wildcard `*.fireside.run → relay IP` (one-time setup)
- Infrastructure: single small VPS (~$10-15/month at launch scale, grows with revenue)

**Relay Client** (added to Fireside binary, implements `TunnelProvider`):
- On startup: connects to relay, authenticates, registers subdomain
- Maintains persistent multiplexed tunnel, handles reconnection
- ACME cert management: obtains Let's Encrypt cert for `name.fireside.run` via HTTP-01 challenge through tunnel, auto-renews
- TLS serving: Fireside switches from plain HTTP to serving TLS directly (~50 line change)
- ~400 lines Go, completely additive to existing code

### What V2 unlocks

- **Persistent URL:** `yourname.fireside.run` — never changes on restart, shareable link
- **True end-to-end:** relay sees bytes, not content
- **API fully private:** Cursor points at `https://yourname.fireside.run/v1`, fully private with no extra setup
- **Open WebUI fully private:** change base URL, done
- **Commercial tier:** reason to pay $8-10/month

**V2 Milestone:** Hosts have a persistent subdomain. All traffic — Chat UI and OpenAI API — is private from intermediaries. Clients point any tool at `https://yourname.fireside.run/v1` and it works. Fireside generates recurring revenue.

---

## Server Extensions (V1.x)

These are independent server improvements — no relay dependency, can ship any time after V1. Implementation approach decided when each is prioritised.

**Capabilities:**
- Image generation via Ollama-supported diffusion models (FLUX.1, Stable Diffusion). Chat UI inline display + `/v1/images/generations` OpenAI-compatible endpoint.
- RAG: document ingestion → chunking → embedded vector store (sqlite-vec, zero new dependencies) → automatic context injection. `/v1/embeddings` API for programmatic access.
- Database connections: read-only SQL queries via LLM-generated SQL against a host-provided database. Significant security scope — strict read-only sandboxing required.

**Stability & Operations:**
- Hardware detection (RAM, CPU, GPU shown in dashboard; model size warnings before downloading large models)
- Concurrency limits / request queuing — prevent multiple simultaneous heavy users from crashing the server

---

## Relay Extensions (V2+)

These require the V2 relay to exist first.

- Multiple relay regions — redundancy and lower latency for global users
- Custom domain support — `ai.yourcompany.com` pointing to Fireside relay
- Enterprise tier — team management, audit logs, SSO, commercial license alongside AGPL. Pricing: $50-100/month for multi-host organisations.
