# Fireside

## What It Is

Fireside uses the distribution model that Plex proved works — one techie sets up a server, and their whole group benefits — applied to AI instead of media.

One person in a group (the **Host**) runs an AI server on their hardware. Everyone else (the **Clients**) uses it through a browser — like ChatGPT, but private, free, and running on a machine owned by someone they trust.

The Plex lesson:
- Plex proved that millions of non-technical people will use self-hosted software if a techie in their life sets it up for them. That social mechanic (techie → serves group) is what we're applying.
- Plex struggled to monetize (premium features weren't enough, so they pivoted to ad-supported streaming and diluted their brand). Our relay service avoids this — it's infrastructure the Host actually needs, not a nice-to-have.

### Two Roles

**Host**
- The person who owns the hardware (the "techie" in the group)
- Installs the Fireside server with a single command
- Picks which AI models to run (text, image generation, embeddings, etc.)
- Gets a shareable URL and invite links for their group
- Manages users, API keys, and model settings

**Client**
- Everyone else — family, friends, teammates
- Clicks an invite link → opens in browser → starts chatting
- No install. No technical knowledge. No app store.
- Can optionally "Add to Home Screen" for a native-app feel (PWA)
- Developers in the group can also get API keys for programmatic access

### Product Layers (in priority order)

**1. Chatbot (the thing people use)**
A beautiful chat interface served as a web app by the Host's server. This is what Clients see when they click their invite link. It should feel as good as ChatGPT. This is the product for 90% of users.

This ships first. Without this, the Host has nobody to show the server to.

**2. API (the thing developers use)**
An OpenAI-compatible API with key-based auth. Developers in the group can call it the same way they'd call the OpenAI or Anthropic API:
- Chat/completion endpoints
- Image generation
- Embeddings (for RAG, semantic search, etc.)

Because it's OpenAI-compatible, every existing tool just works: LangChain, CrewAI, Cursor, Continue.dev, etc. We don't build an agent framework — we just make sure the API is standard enough that existing ones plug in.

**3. Host Dashboard (the thing the Host manages)**
A web-based admin panel for the Host:
- See who's connected and usage stats
- Manage models (download, update, remove)
- Create/revoke API keys and invite links
- System health (GPU usage, memory, disk)

### How It Works

**Host setup (under 10 minutes):**
```
curl -fsSL https://fireside.dev/install | sh
```
One command. Auto-detects GPU. Opens a setup wizard in the browser:
1. Pick models (sensible defaults pre-selected)
2. Create admin account
3. Get your shareable link: `https://kazems-ai.fireside.dev`

Text the link to your family. Done.

**Client experience (under 1 minute):**
1. Receive invite link from Host (text, email, whatever)
2. Click link → opens in browser
3. Create a username
4. Start chatting

No install. No app store. Works on phone, laptop, tablet — anything with a browser.

### Networking

The Host's server sits behind a home network. Clients need to reach it from the internet.

**V1: Cloudflare Tunnel + Application-Layer Encryption (built-in)**
- Server automatically creates a Cloudflare Tunnel during setup
- Host gets a public URL (e.g., `https://kazems-ai.fireside.dev`)
- No port forwarding, no static IP, no DNS config needed
- Application-layer encryption runs on top — messages are encrypted before they enter the tunnel, so Cloudflare — only sees opaque blobs

Cloudflare Tunnel handles the networking (NAT traversal, subdomain). Application-layer encryption handles the privacy (Cloudflare can't read message content). This gives us strong privacy from day one without building custom infrastructure.

**V2: Our own relay service (paid)**
- We run relay infrastructure — removes dependency on Cloudflare
- Same application-layer encryption runs on top
- Custom domains, guaranteed uptime
- This is a natural paid tier
- V2 is about **independence from Cloudflare**, not about security — intermediary protection is already solved in V1

### Application-Layer Encryption (built into MLP)

Encryption is not a future feature. It ships from day one. This is core to the trust story.

How it works:

- When the Host creates an invite link, a **unique per-user encryption key** is generated and embedded in the URL fragment (`#key=...`)
- URL fragments are NEVER sent to the server or to Cloudflare — the browser keeps them local
- The chatbot JS encrypts every message with Web Crypto API before sending, decrypts responses after receiving
- Web Crypto API is built into all modern browsers, hardware-accelerated, no external library needed
- Cloudflare (or later, the relay) only sees encrypted blobs — gibberish
- The Host's server decrypts to process through the LLM, then encrypts the response

This means: even though traffic routes through Cloudflare, **nobody in the middle can read the conversations**. Only the Client's browser and the Host's server have the keys.

The encryption protocol spec will be published so security researchers can verify the design. Implementation adds ~1-2 weeks to the timeline.

### Open Source Decision

Not finalized. The architecture is designed so either path (open or closed source) is possible without rework. The server, chat UI, and managed services (relay, DNS) are separate components. See FAQ #5 for the full analysis.

Regardless of the decision, trust is built through:
- Encryption that's verifiable in the browser (open DevTools, see encrypted payloads)
- Published encryption protocol spec (so the crypto design can be independently reviewed)
- Third-party security audits (when there's traction)
- Reputation and track record over time

### What Success Looks Like

A Host installs the server in 10 minutes. They text a link to 5 family members. All 5 are chatting with private AI within 60 seconds of clicking the link. Nobody installed anything. Nobody's data left the family's hardware. The Host feels like a hero.

---

## Why It Exists

**1. Trust & Safety**
You might not trust big cloud providers (like AWS or GCP) with your private data, but you do trust your family or friends. Fireside runs on hardware owned by someone you know—like your cousin or parent—so you know exactly where your data lives. By using open software, the system is verifiable and safe.

**2. Resource Efficiency**
It is unrealistic and wasteful for every person to own expensive AI hardware that sits idle 95% of the time. Fireside lets a group leverage one powerful machine (e.g., from the "techie" in the family) to serve everyone. This makes high-performance local AI accessible without everyone needing their own dedicated rig.

Fireside sits in between these worlds, making private AI practical for normal people.

---

# FAQ

## 1. Are there existing products like this?

The landscape has five categories. None of them deliver what Fireside proposes.

**A. Enterprise On-Prem AI** — NVIDIA DGX, HPE Private Cloud AI, Dell AI Factory.
$50K–$500K+, requires IT teams. Solves the enterprise problem, not the family problem.

**B. DIY Self-Hosted Server Software** — Ollama, Open WebUI, LibreChat, LobeChat, AnythingLLM, LocalAI, Dify.
Powerful, but requires Docker/CLI/networking skills. No concept of "group ownership" or simple onboarding for non-technical users.

**C. Personal Local AI Desktop Apps** — LM Studio, GPT4All, Jan.ai, Msty.
Single-user, single-machine. No sharing, no remote access, everyone needs their own hardware.

**D. Consumer AI Hardware** — NVIDIA DGX Spark (~$3K), Rabbit R1, Humane AI Pin, Friend Pendant.
DGX Spark is developer-focused with no multi-user. The wearables are cloud-dependent single-user gadgets.

**E. DIY Networking for Group Access** — Tailscale + Ollama + Open WebUI, Cloudflare Tunnels.
This is the closest to what we're building. People are already doing it. But it's 3+ tools duct-taped together, fragile, and requires ongoing maintenance from the techie. No unified product.

**The gap:** No product combines shared hardware + remote group access + consumer-level UX + application-layer encryption + per-user keys + minimal maintenance into a single install. That's what Fireside is.

---

## 2. Is this really private?

Privacy depends on who you're asking about:

- **AI companies** — Models run on the Host's machine. No data goes to OpenAI, Anthropic, etc.
- **Fireside (us)** — We provide the networking relay. Traffic through it is encrypted at the application layer. We cannot read it.
- **Network layer (Cloudflare, ISPs)** — Messages are encrypted in the browser (Web Crypto API) before being sent. This is built into the MLP from day one, not a future feature. Cloudflare and ISPs only see encrypted blobs. Keys are exchanged via the invite link's URL fragment, which browsers do not transmit to servers.
- **The Host** — The Host has physical access to the server machine. The server must decrypt messages to process them through the LLM. The Host can technically access conversations. This is a known tradeoff — the trust model assumes you know the Host personally. Future versions may add per-user encrypted storage.

---

## 3. What models would it run?

All open-weight models. The Host picks which to download. The server needs to cover four use cases:

**Text chat** (the main use case for most Clients):

| Model | Params | VRAM (Q4 quantized) | Notes |
|---|---|---|---|
| Qwen3 8B | 8B | ~6GB | Good quality for the size. Fast. Runs on most GPUs. |
| Llama 3.1 8B | 8B | ~6GB | Meta's model. Well-rounded general chat. |
| Qwen3 32B | 32B | ~20GB | Noticeably smarter. Needs RTX 3090/4090 (24GB). |
| DeepSeek-R1-Distill 32B | 32B | ~20GB | Strong reasoning. Distilled from DeepSeek-R1. |
| Llama 3.3 70B | 70B | ~40GB | Near GPT-4 quality. Needs 2x 24GB GPUs or 64GB+ Apple Silicon. |

**Code** (for developer Clients):

| Model | Params | VRAM (Q4) | Notes |
|---|---|---|---|
| Qwen 2.5 Coder 32B | 32B | ~19GB | Fits on a single 24GB GPU. Strong coding performance. |
| DeepSeek-Coder-V2-Lite | 16B | ~10GB | Lighter option for smaller GPUs. |

**Image generation** (text-to-image):

| Model | VRAM needed | Notes |
|---|---|---|
| FLUX.1 schnell | ~12GB | Fast. Apache 2.0 license. Good quality. |
| FLUX.2 Klein (4B) | ~9GB | Newer, lighter variant. Works on mid-range GPUs. |
| Stable Diffusion 3.5 | ~8-12GB | Mature ecosystem, many extensions and fine-tunes available. |

**Embeddings** (for developers building RAG apps via the API):

| Model | Params | RAM needed | Notes |
|---|---|---|---|
| nomic-embed-text v2 | ~137M | <1GB | Runs on CPU. No GPU needed. Good MoE architecture. |
| all-MiniLM-L6-v2 | 22M | <200MB | Tiny. Runs on anything. Good enough for most RAG. |

The server manages downloads, loading, and switching. The API is OpenAI-compatible, so Clients and developer tools don't need to know which specific model is running behind it.

The above are recommended defaults. Since the server uses Ollama as the model runtime, the Host can pull **any model from the Ollama library** (hundreds of options). The server doesn't care which model is loaded — it talks to Ollama's API regardless. Custom models are at the Host's discretion; the recommended list is what we've tested and verified works well.

---

## 4. What hardware does the Host need?

A computer with a decent GPU. Here are realistic tiers based on what people actually own (per Steam Hardware Survey, the RTX 3060 is the most popular GPU):

| Tier | Example Hardware | VRAM | What it runs | Estimated cost (used) |
|---|---|---|---|---|
| **Entry** | RTX 3060 / RTX 4060 | 8-12GB | 8B chat models, small image gen | $200-300 |
| **Mid** | RTX 3090 / RTX 4090 | 24GB | 32B chat models, code models, FLUX image gen | $800-1,800 |
| **High** | 2x RTX 3090 / RTX 5090 | 48GB / 32GB | 70B chat models, multiple models loaded at once | $1,500-2,500 |
| **Apple** | Mac Mini M4 Pro (48GB) | 48GB unified | 32B-70B models, quiet, low power, always-on | $1,800-2,000 |
| **Apple Max** | Mac Studio M4 Ultra (192GB) | 192GB unified | Multiple large models simultaneously | $4,000-8,000 |

Notes:
- Apple Silicon uses unified memory (CPU and GPU share RAM), so a 48GB Mac can run models that would need 48GB VRAM on a dedicated GPU. Inference is slower than NVIDIA but the machines are quiet and good for 24/7 hosting.
- Most techie users who game already own an RTX 3060-4090. This is the most likely Host hardware.
- Concurrent users: an 8B model on a 24GB GPU can handle 3-5 simultaneous requests comfortably. A 32B model on the same GPU handles 1-2. For a group of 5-15 people who don't all chat at the same time, an entry-to-mid tier GPU is sufficient.
- Embedding models run on CPU and need negligible resources. They can run alongside the main chat model without issue.

---

## 5. Would it be open source?

Undecided. There are good arguments for both, and the decision doesn't need to be made upfront.

**Case for closed source:**
- Plex is closed source and built this exact model successfully
- Monetization is simpler — no tension between free community and paid features
- Harder for competitors to fork and undercut

**Case for open source:**
- The product is not that hard to replicate. It's a Go server wrapping Ollama with a chat UI. With AI coding agents in 2026, someone motivated could rebuild it in a few weeks. Closed source doesn't offer much protection here.
- Open source drives faster adoption. The r/selfhosted and r/LocalLLaMA communities strongly prefer open source and will promote it organically.
- Trust is easier — users can verify the code, not just a published spec.
- For the creator, the project has strong portfolio/resume value as an open-source project, which may matter more than direct revenue depending on personal priorities.

**Conclusion:** Don't choose yet. Build the architecture so that either path is possible. Keep the server, the chat UI, and any managed services (relay, DNS routing) as separate components. If you open source the server and chat UI, the relay service can still be closed and paid — that's where the real monetization is anyway. If you keep it all closed, nothing is lost.

The encryption protocol spec will be published separately regardless, so the security design can always be independently reviewed.

---

## 6. Who is this for?

The Host is the real customer. Clients come along because the Host set it up for them.

**The Host** is someone who:
- Owns a gaming PC or workstation with a decent GPU
- Is comfortable running a terminal command
- Has 3-15 people in their life who would use AI regularly
- Gets satisfaction from providing something useful to their group

This is the same person who runs a Plex server, a Minecraft server for their friends, or a Pi-hole for their home network. They exist in almost every extended family or friend group.

**Why they wouldn't just tell everyone to use ChatGPT:**

- **Cost** — ChatGPT is $20/person/month. A family of 5 heavy users is $100/month, or $1,200/year. A $400 used GPU pays for itself in 4 months.
- **Privacy** — Some use cases genuinely can't go through cloud AI. A lawyer processing client documents, a therapist taking notes, a family discussing financial or medical situations.
- **Control** — No content policy restrictions. No dependency on a company's pricing decisions. No risk of a provider shutting down or changing terms.
- **The hero factor** — The same motivation that drives Plex hosting: the techie enjoys being the person who gives their circle something valuable for free.

**Three segments, in order of likelihood to adopt:**

1. **Self-hosting enthusiasts** — Already run Plex, Home Assistant, Nextcloud, etc. They have the hardware, the skills, and the inclination. They're on r/selfhosted and r/LocalLLaMA. They'll try it because it's a cool new thing to host. Their families become Clients automatically.

2. **Privacy-sensitive professionals** — Lawyers, therapists, financial advisors, doctors. They work with confidential data and genuinely cannot send it through cloud AI providers. They or an IT-savvy colleague become the Host.

3. **Cost-conscious groups** — Families, student groups, or small teams where 5+ people use AI heavily. The math makes self-hosting cheaper than multiple paid subscriptions.

**Who this is NOT for:**
- Enterprises (they need compliance, SLAs, support contracts — they'll buy from Microsoft or NVIDIA)
- People who use AI once a week (the free tier of ChatGPT is fine for them)
- People with no techie in their life (nobody to be the Host)

---

## 7. How does this make money?

It doesn't, for now. Everything is free. The priority is getting Hosts to install it and getting their groups using it. Charging before there are users is premature.

The server software should stay free permanently. More Hosts = more Clients = more value. Charging for the server limits adoption for no good reason.

The monetization comes later, from managed services:

- **Relay service** — V1 uses Cloudflare Tunnel (free). V2 introduces our own relay infrastructure with better uptime, custom domains, and no Cloudflare dependency. Free tier for basic use, paid tier (~$5-10/month) for unlimited. This is real infrastructure that costs money to run, so the pricing is justified.
- **Premium features** — Usage analytics, automatic model updates, priority support. These are nice-to-haves that power users would pay for.

This is the same pattern as Cloudflare (free tier + paid infrastructure), Tailscale (free personal + paid teams), and Plex (free app + paid Plex Pass).

---

## 8. What happens when the Host's machine is off?

Clients can't use the AI. This is a real limitation — a gaming PC is not a data center.

But Plex has the same problem and it's fine. When the Host's PC is off, the Plex library is unavailable. Nobody panics. The tolerance is built into expectations: this runs on someone's personal machine, not cloud infrastructure.

**V1 mitigations:**
- Server registers as a system service — auto-starts on boot, so reboots and power outages recover without the Host doing anything
- Clients see a clear "offline" page, not a broken page or cryptic error
- Chatbot auto-reconnects when the server comes back, no manual refresh needed

**V2 mitigations:**
- Recommend always-on hardware to serious Hosts. A Mac Mini M4 draws ~15W (~$2/month electricity). Silent, small, designed for 24/7 operation. This is the same "graduation path" Plex users follow — start on a gaming PC, eventually get a dedicated box.
- Scheduled uptime — Host sets available hours (e.g., 8am–midnight). Machine auto-wakes and auto-sleeps.

**Future (not MVP):**
- Multi-Host federation — allow multiple people in the group to be Hosts. If one is offline, Clients route to another. Also solves capacity (one Host runs chat models, another runs image gen). Adds significant complexity (routing, cross-Host accounts, model coordination) so this is a later feature.

---

## 9. What is the full Client experience?

**First time (one-time setup, ~30 seconds):**

1. The Host sends them a link over text, email, WhatsApp, or just shows them in person. Something like: `https://abc123.fireside.dev/invite/x7k9m2`
2. Client clicks the link. A page opens in their browser:
   - Shows the server name (e.g., "Kazem's AI")
   - Says "You've been invited to a private AI assistant"
   - Fields: choose a username, choose a password
   - One button: Create Account
3. Account created. Redirected straight into the chatbot. They can start typing immediately.
4. The invite link is now used up. It won't work for anyone else.

**Daily use (every time after that):**

1. Client opens `https://abc123.fireside.dev` in their browser (or taps a bookmark / home screen icon).
2. If not logged in, they see a login page. Username + password. They log in.
3. If already logged in (cookie still valid), they go straight to the chatbot.
4. Left sidebar shows their conversation history (like ChatGPT). They can continue an old conversation or start a new one.
5. If the Host has multiple models available, a dropdown lets them pick which model to use.
6. They type, they get responses. Streaming text, same experience as ChatGPT.

**From another device:**

1. Client opens the same URL on a different device (e.g., they signed up on their phone, now using their laptop).
2. They log in with the same username and password.
3. All their conversations are there. History syncs because it's stored on the server, not in the browser.

**Managing their own data:**

The Client has a settings page (accessed from the chatbot UI) where they can:
- Change their password (without asking the Host)
- Change their display name
- Delete individual conversations
- Delete ALL their data (nuclear option — wipes everything from the server)
- Export their chat history (download as a file)
- Delete their account entirely

The Client is not a guest. They have control over their own data. The Host manages the server, but each Client manages their own space within it.

**What they see when the server is offline:**

Instead of a broken page or a browser error, they see a clean page:
> "This server is currently offline. It will be available when the host's machine is running."

The chatbot auto-reconnects when the server comes back. No manual refresh needed.

**What they see at the bottom of every page:**

A small line like: `🔒 Private AI · Hosted by Kazem`

This makes the trust explicit. The Client always knows whose machine their data is on. This is more transparent than ChatGPT, where you have no idea which data center or country your data lives in.

**What the Client does NOT see or control:**
- Which models are available (Host decides — same as ChatGPT deciding which GPT version is available)
- Other users' conversations or accounts
- Server settings, GPU stats, or admin functions
- The admin dashboard (only accessible from the Host's local machine)

---

## 10. What is the latency like for Clients?

**Concurrency math (10-user group):**

Assumptions:
- 10 users (which may be more devices — a single user can log in from phone and laptop simultaneously, same account, same history)
- Each active ~1 hour per day on average
- Active window: 6 AM to 12 AM (18 hours)
- In a 1-hour session, a user sends maybe 20-30 messages. Each response takes 5-30 seconds to generate. So actual GPU-busy time per session is ~10-15 minutes, not 60.

Average concurrent users: 10 user-hours ÷ 18 hours ≈ 0.6
Peak hours (7-10 PM, ~40% of usage): ~1.3 average during peak
P75 concurrent users during peak: **2-3 users**

Most of the time, 0 or 1 users are actively generating a response. Even at peak, 2-3 concurrent users is the realistic max. And "concurrent" doesn't mean simultaneous GPU requests — messages are bursty and staggered.

**Inference speed by hardware tier (benchmarks from community tests):**

| Setup | Model | Tokens/sec (single user) | ~Time for a 200-token response | With 2 concurrent |
|---|---|---|---|---|
| RTX 3060 12GB | Qwen3 8B Q4 | ~45-50 tok/s | ~4 seconds | ~25 tok/s each, ~8 seconds |
| RTX 4090 24GB | Qwen3 8B Q4 | ~120-130 tok/s | ~1.5 seconds | ~60-70 tok/s each, ~3 seconds |
| RTX 4090 24GB | Qwen3 32B Q4 | ~30-40 tok/s | ~5-7 seconds | ~15-20 tok/s each, ~10-13 seconds |
| Mac M4 Pro 48GB | Qwen3 32B Q4 | ~18-25 tok/s | ~8-11 seconds | ~10-15 tok/s each, ~13-20 seconds |

Time to first token (TTFT) adds ~200-500ms on top (model loads the prompt, generates the first word). Cloudflare Tunnel adds ~10-50ms of network latency — negligible compared to inference time.

**Compared to ChatGPT:**

| | ChatGPT (GPT-4o) | RTX 3060 + 8B | RTX 4090 + 8B | RTX 4090 + 32B |
|---|---|---|---|---|
| Speed | ~50-80 tok/s | ~45-50 tok/s | ~120-130 tok/s | ~30-40 tok/s |
| TTFT | ~500ms-1s | ~200-400ms | ~100-200ms | ~300-600ms |
| Quality | Best | Good | Good | Very good |

An RTX 4090 with Qwen3 8B is actually **faster** than ChatGPT. An RTX 3060 with 8B is roughly comparable speed. The 32B model on any hardware is a bit slower but noticeably smarter.

**Bottom line:** For a typical 10-user group, even entry-level hardware (RTX 3060) delivers a responsive experience. The Client won't feel like they're using a slow product. At 45+ tokens per second, text streams smoothly — it feels like someone typing very fast.

---

## 11. Can a Host run multiple servers on one machine?

No. One machine = one server = one URL = one group of users. Same as Plex — you install once, you get one server.

If someone needs separate servers for separate groups (e.g., family vs. coworkers), they install on a second machine. Within one server, different access levels per user (model access, rate limits) can be added in V2.

This keeps the install simple and the architecture predictable. No multi-tenancy, no port juggling, no container orchestration.

---

## 12. How does API authentication work?

The API key is the authentication. No login, no session, no username/password. Send the key in the HTTP header, get access. This is how every API works (OpenAI, Anthropic, Google).

```
curl https://abc123.fireside.dev/v1/chat/completions \
  -H "Authorization: Bearer sk-..." \
  -d '{"messages": [{"role": "user", "content": "hello"}]}'
```

**Key rules:**
- Keys are tied to user accounts. Usage is tracked per user. Deleting a user kills their keys.
- Per-key rate limiting (e.g., 100 requests/hour default). Host adjusts from admin panel.
- Both the Host and Clients can generate keys — Host from the admin dashboard, Clients from their settings page.
- Host can see and revoke all keys from the admin panel.

**Encrypted API calls:**

The chatbot UI has built-in encryption (Web Crypto in the browser). But can API calls also be encrypted?

Yes — through our SDK:

```python
# Direct mode (standard OpenAI client — HTTPS only, no application-layer encryption):
from openai import OpenAI
client = OpenAI(base_url="https://abc123.fireside.dev/v1", api_key="sk-...")

# SDK mode (full encryption — encrypts before sending, decrypts after receiving):
from fireside import Fireside
client = Fireside(url="https://abc123.fireside.dev", api_key="sk-...", encryption_key="ek-...")
```

The SDK is a thin wrapper (~200-300 lines) around the standard OpenAI client. It encrypts outgoing messages with AES-GCM, sends the encrypted blob, and decrypts the response locally. Same algorithm as the browser.

Two API modes:

| Mode | Encryption | Works with |
|---|---|---|
| **Direct** | ❌ HTTPS only | Any OpenAI-compatible tool (LangChain, CrewAI, curl) |
| **SDK** | ✅ Full application-layer encryption | Our Python/Node SDK |

The Host can configure which modes are allowed: both (default), encrypted only, or direct only.

---

# MLP (Minimum Lovable Product)

## Hypothesis

A techie will install a private AI server, share it with their family/friends, and those people will actually use it regularly.

Everything in the MLP exists to test this. If it doesn't directly serve the Host or Client experience, it's cut.

## The Full Experience

### Host Journey

**Step 1: Install**
```
curl -fsSL https://fireside.dev/install | sh
```
This installs three things: the Fireside server binary, Ollama, and cloudflared. One command, no decisions yet.

**Step 2: Setup Wizard (local web UI)**

The server starts and opens `http://localhost:3000/setup` in the Host's browser. This is a step-by-step wizard:

1. **Hardware detection** — Server scans the machine. Shows: GPU model, VRAM, system RAM, OS. The Host sees what they have and what they can run.

2. **Pick models** — Recommended models are shown based on detected hardware:

   | Model | Size | VRAM needed | Who it's for |
   |---|---|---|---|
   | Qwen3 0.6B | ~400MB | Runs on CPU | Test model. Verify everything works before downloading a big one. |
   | Qwen3 8B | ~6GB | 8GB+ GPU | The default. Good quality. Fast. Recommended for most Hosts. |
   | Qwen3 32B | ~20GB | 24GB+ GPU | Best quality. Only shown if the Host has enough VRAM. |

   Below the recommended list, an "Advanced" field lets the Host type any Ollama model name (e.g., `mistral:7b`, `llama3.1:8b`, `phi3:medium`). Since Ollama handles all model formats, templates, and quantization internally, any model from the Ollama library works with zero extra integration on our side.

   Host picks one or more. Downloads happen with progress bars. The test model downloads in seconds so the Host can verify the setup immediately. If a custom model is too large for the detected hardware, the wizard shows a warning before downloading.

3. **Create admin account** — Host sets their admin username and password.

4. **Name your server** — Host gives it a name (e.g., "Kazem's AI"). This shows in the chatbot UI and the invite page.

5. **Go online** — Server creates a Cloudflare Tunnel. Displays the public URL: `https://abc123.fireside.dev`. Host copies this.

6. **Done** — Redirects to the admin dashboard.

**Step 3: Admin Dashboard**

After setup, the Host manages everything from `http://localhost:3000/admin`:

- **Invite links** — Create invite links with optional expiry or usage limit. Copy/share with family.
- **Users** — See who has accounts. Delete/disable users.
- **Models** — See loaded models. Download new ones from recommended list or pull any Ollama model by name. Activate/deactivate. Shows VRAM usage per model.
- **API keys** — Generate API keys for developer access.
- **Status** — GPU usage, active connections, server uptime.

### Client Journey

**Step 1:** Host texts them: *"Hey, try this: https://abc123.fireside.dev/invite/x7k9m2"*

**Step 2:** Client clicks the link. Sees a clean page:

> **Join Kazem's AI**
>
> You've been invited to a private AI assistant.
>
> Choose a username: [________]
> Choose a password: [________]
>
> [Create Account]

**Step 3:** Account created. Redirected to the chatbot. Start chatting.

**Step 4:** Next time, Client goes to `https://abc123.fireside.dev` and logs in. Or they bookmark it.

### What happens without an invite link?

If someone visits `https://abc123.fireside.dev` without being logged in and without an invite link, they see:

> **This is a private AI server.**
>
> If you were invited, use the invite link you received.
>
> [Log in]

No account creation. No information about who runs it or what models it has. The server is invisible to the public internet.

### Authentication Design

- All user accounts live **on the Host's server** (SQLite), not on our cloud.
- We never see or store user credentials.
- Our cloud only does DNS routing: "abc123.fireside.dev routes to Cloudflare Tunnel XYZ."
- Invite links are one-time or limited-use tokens generated by the Host.
- Sessions use standard HTTP cookies over HTTPS.

This is simpler and more private than Plex (where both Host and Client need accounts on plex.tv).

### API Access

The server exposes an OpenAI-compatible API at `https://abc123.fireside.dev/v1/chat/completions`.

- Requires an API key (Host generates keys from the admin panel).
- Text-to-text only for MLP. Streaming and non-streaming.
- Developers can point LangChain, CrewAI, or any OpenAI-compatible tool at this URL.
- This is mostly a pass-through to Ollama's existing OpenAI-compatible endpoint, with API key authentication added on top.

Minimal extra work since Ollama already supports this format.

## What's OUT (for now)

| Feature | Why it's cut |
|---|---|
| Image generation | Text chat is the core use case. Image gen requires a separate model pipeline. V2. |
| Embeddings API | Developer feature. Not enough demand to justify in MLP. |
| Host dashboard with analytics | Basic admin page is enough. Usage charts and stats are V2. |
| Wake-on-LAN / scheduled uptime | V2 feature. |
| Multi-Host federation | V3+ feature. |
| Custom domains | V2 feature. Use auto-generated subdomain for now. |
| Our own relay | Cloudflare Tunnel + application-layer encryption provides both functionality and privacy for MLP. Own relay is V2 for independence. |

---

## Technical Documents

The implementation details are in separate documents:

- **[tech-plan.md](./tech-plan.md)** — Tech stack, phased build plan, deliverables, success criteria
- **[architecture.md](./architecture.md)** — High-level system design: components, data flow, API contracts, deployment topology
- **[detailed-design.md](./detailed-design.md)** — Low-level implementation: SQLite schema, auth flows, encryption protocol spec, message formats, code examples

> **Decision log:**
> - Chat UI: Custom HTML/CSS/JS (not a NextChat fork). Simpler, no framework dependency, fully understood codebase. Can upgrade later if needed.
> - Admin: Basic admin API (curl-testable) ships in Phase 1 alongside the backend. Browser-based admin page comes in Phase 2.

