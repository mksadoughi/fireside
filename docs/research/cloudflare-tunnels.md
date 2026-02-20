# Cloudflare Tunnels — Research (Feb 2026)

Reference document for Cloudflare Tunnel setup options in Fireside.

---

## Two Approaches

### 1. `trycloudflare` (Quick Tunnels) — MLP Default

**Command:**
```bash
cloudflared tunnel --url http://localhost:7654
```

**What happens:**
- Instantly creates a temporary tunnel
- Gets a random URL like `https://random-words.trycloudflare.com`
- No Cloudflare account needed
- No domain ownership needed
- URL changes every time cloudflared restarts

**Pros:**
- Zero friction — works immediately
- No account, no auth, no config
- Perfect for MLP: Host can share the URL and start using immediately

**Cons:**
- URL is random and changes on restart
- Not professional-looking (`random-words.trycloudflare.com`)
- No persistence — if server reboots, URL changes and all shared links break

**When to use:** MLP V1 default. Gets the product working immediately.

---

### 2. Named Tunnels — Post-MLP Upgrade

**Requirements:**
- Cloudflare account (free)
- Domain name that Host owns (or we provide `*.fireside.dev` subdomains)
- One-time setup via `cloudflared` CLI or Cloudflare dashboard

**Setup steps:**
```bash
# 1. Authenticate with Cloudflare
cloudflared tunnel login

# 2. Create a named tunnel
cloudflared tunnel create fireside-server
# Output: Created tunnel fireside-server with id <UUID>

# 3. Route DNS to the tunnel
cloudflared tunnel route dns <UUID> kazems-ai.fireside.dev
# Creates a CNAME: kazems-ai.fireside.dev → <UUID>.cfargotunnel.com

# 4. Create config file
cat > ~/.fireside/cloudflared.yml << EOF
tunnel: <UUID>
credentials-file: /path/to/credentials.json
ingress:
  - hostname: kazems-ai.fireside.dev
    service: http://localhost:7654
  - service: http_status:404
EOF

# 5. Run the tunnel
cloudflared tunnel --config ~/.fireside/cloudflared.yml run
```

**Pros:**
- Persistent URL that survives restarts
- Professional subdomain (`kazems-ai.fireside.dev`)
- Cloudflare free tier supports up to 1000 named tunnels

**Cons:**
- Requires Cloudflare account setup
- Requires domain ownership (or we must provide subdomains)
- More complex initial setup

**When to use:** Post-MLP upgrade path via `fireside tunnel setup` command.

---

## Fireside's Strategy

| Phase | Tunnel Type | URL | Setup |
|---|---|---|---|
| MLP V1 | trycloudflare | `random-words.trycloudflare.com` | Automatic, zero config |
| V1.1+ | Named tunnel | `kazems-ai.fireside.dev` | `fireside tunnel setup` guided wizard |

**V1.1 upgrade path:**
- `fireside tunnel setup` command walks Host through:
  1. Creating a Cloudflare account (link to signup)
  2. Running `cloudflared tunnel login`
  3. Choosing a subdomain (either their own domain or a `*.fireside.dev` subdomain we provision)
  4. Creating and configuring the named tunnel
  5. Updating server config to use persistent URL

**Our DNS service (for `*.fireside.dev`):**
- We own the `fireside.dev` domain on Cloudflare
- Thin API endpoint that creates CNAME records: `<subdomain>.fireside.dev → <UUID>.cfargotunnel.com`
- Host requests a subdomain during `fireside tunnel setup`
- We verify uniqueness and create the CNAME
