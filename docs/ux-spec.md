# Fireside UX Specification

## 1. Design Philosophy

**Two separate web properties:**

- **Project Website** (e.g. `getfireside.com`) -- Static marketing/docs. No backend, no user data. Think: jellyfin.org.
- **Server UI** (e.g. `localhost:7654` or `ai.kazem.com`) -- The actual product running on a host's hardware. This is what hosts and clients interact with.

The Plex analogy: `plex.tv` is the project website. A friend's Plex server at `192.168.1.5:32400` is the server UI.

**Core UX principles:**

- Zero dependencies. Fireside ships as a single binary that handles everything, including downloading and managing the AI runtime (Ollama) automatically. The host should never need to install anything else.
- The host's primary job is managing the server. Their default view is the Dashboard.
- The client's only job is using AI. Their default view is Chat. They never see admin UI.
- **Two equally important ways to use Fireside:** the Chat UI (browser-based, zero setup) and the API (OpenAI-compatible, connect from any tool). The chat UI is the easiest entry point, but the API is what makes Fireside a platform — it lets users connect Cursor, Python scripts, custom apps, or anything that speaks the OpenAI format. Both are first-class features from day one.
- Every screen must work well on mobile. A major use case is the host chatting from their own phone, or a client clicking an invite link on their phone.
- The product should feel personal -- each server is branded with the host's chosen name.
- The product should feel premium, not like a prototype. Dashboard uses a proper sidebar layout, UI is polished, interactions are smooth.
- Errors and edge cases must be handled gracefully, never a blank screen or cryptic message.

**Default port: 7654** (chosen to avoid conflicts with common dev tools like React/3000, Flask/5000, Django/8000, etc.)

---

## 2. User Types and Use Cases

**Host (Admin):** Downloads Fireside, runs it on their GPU machine. Two primary use cases:

1. **Personal use across devices** -- The host runs Fireside on their desktop/server at home and uses their own AI from their phone, laptop, or any other device — via the Chat UI in a browser, or via the API from tools like Cursor, Python scripts, or any OpenAI-compatible client. No sharing involved. This is the simplest and most common starting point.
2. **Sharing with friends** -- The host invites friends to use their AI server. They manage who has access, what models are available, and monitor usage. Sharing can mean giving a friend access to the Chat UI (via invite link), or giving them an API key to connect from their own tools.

Both use cases coexist naturally. A host might start using Fireside solo and later invite friends, or do both from day one.

**Client (Invited User):** Receives a link from the host, registers, chats with AI. Technical knowledge: assume zero. They should never need to understand what "Ollama" or "model" means -- they just talk to AI.

**Client API access:** Clients don't create their own API keys. If a client needs API access (e.g. a developer friend who wants to connect from their IDE), the host creates an API key from the Dashboard and shares it with them directly. This keeps the host in control of programmatic access. Self-serve client API keys may be added in a future version.

**Multi-device usage:** Both hosts and clients can use Fireside from any device (desktop, laptop, phone, tablet) by visiting the server URL. Conversations sync automatically since everything is stored server-side. This should feel completely natural with no special setup.

---

## 3. The Project Website

Static site hosted on GitHub Pages or Cloudflare Pages. Zero backend.

**Analytics:** Use Cloudflare Analytics (or similar privacy-respecting tool) for website traffic. Host binaries on GitHub Releases, which provides built-in download counts per asset. No cookies, no tracking scripts, consistent with the privacy-first brand.

**Landing Page** (`/`)

- Hero section: one clear sentence explaining what Fireside is
  - e.g. "Run your own private AI. Use it anywhere. Share it with friends."
- 4 value props (icons + one-liners):
  - Private: "Your hardware, your data. Nothing leaves your machine."
  - Anywhere: "Chat from your phone, laptop, or any device."
  - Shareable: "Invite friends with a link. They chat, you host."
  - API-first: "Connect any tool — Cursor, Python, anything that speaks OpenAI."
- Screenshot of the chat interface in action
- API code snippet (shows how easy it is to connect):
  ```python
  from openai import OpenAI
  client = OpenAI(base_url="https://ai.kazem.com/v1", api_key="sk-...")
  response = client.chat.completions.create(
      model="llama3.2:3b",
      messages=[{"role": "user", "content": "Hello!"}]
  )
  ```
- "Download" primary CTA button
- "View on GitHub" secondary link
- "How it works" section: 3 steps
  1. Download and run Fireside (one file, zero setup)
  2. Pick an AI model
  3. Start chatting in the browser — or connect your favorite tools via API

**Download** (`/download`)

- Auto-detect visitor's OS, highlight the matching download
- Binaries: macOS Apple Silicon, macOS Intel, Linux x86, Linux ARM (hosted on GitHub Releases for download tracking)
- One-line install: `curl -fsSL getfireside.com/install | sh`
- Docker alternative: `docker run -p 7654:7654 fireside/fireside`
- No prerequisites listed (Fireside handles Ollama automatically)
- Link to Getting Started docs

**Docs** (`/docs`)

- Getting Started (install, first run, pick a model, invite a friend)
- **API Guide** (top-level section, not buried):
  - Connecting from Python (`openai` SDK)
  - Connecting from Cursor / Continue / other IDE tools
  - Connecting from any OpenAI-compatible client
  - Creating and managing API keys
- API Reference (endpoints, authentication, streaming, rate limits)
- FAQ (hardware requirements, supported models, security, troubleshooting)

**What is NOT on the website:** No user accounts. No server directory. No central registry. Each Fireside server is independent and self-contained.

---

## 4. The Server UI -- Information Architecture

```
Fireside Server
|
|-- #/setup                First-run setup (host only, one-time)
|-- #/login                Login (all users)
|-- #/invite/:token        Invite registration (clients clicking an invite link)
|
|-- #/dashboard            Host Dashboard (admin only, single page with tabs)
|   |
|   |-- SERVER (section)
|   |   |-- [Overview]     Status, stats, getting-started checklist
|   |   |-- [Models]       List, pull, delete AI models
|   |   |-- [Settings]     Server name, password, tunnel URL, reset server
|   |
|   |-- INTERFACES (section)
|   |   |-- [Chat]         Users + invite management + link to chat UI
|   |   |-- [API]          API key management
|
|-- #/chat                 Chat (all authenticated users)
```

**Dashboard mental model:** The sidebar is split into two conceptual groups:

- **Server** — the infrastructure layer. Models, settings, server health. Things that exist regardless of how anyone uses the server.
- **Interfaces** — the ways people use the server. Chat (built-in web UI + user management) and API (programmatic access via OpenAI-compatible endpoints). These are two separate "front doors" to the same AI backend.

**Routing rules:**

- Not logged in + setup incomplete -> `#/setup`
- Not logged in + setup complete -> `#/login`
- Navigated to `#/invite/:token` -> invite registration (regardless of login state)
- Logged in as admin -> `#/dashboard`
- Logged in as client -> `#/chat`
- Admin can freely switch between `#/dashboard` and `#/chat`
- Client attempting to access `#/dashboard` -> redirected to `#/chat`

**Why hash-based SPA routing:** Simplest to build in vanilla JS. No server-side routing changes needed. The Go server just serves index.html for all paths.

**Why OpenAI API format (not Ollama's):** The OpenAI API format is the de facto standard. Every major tool supports it — Cursor, Continue, Aider, LiteLLM, LangChain, the `openai` Python/Node SDKs. Users connect by changing one line (`base_url`). Ollama's API is non-standard and far fewer tools support it natively. Since we're wrapping Ollama with auth, multi-user, and conversations anyway, we need our own API layer — and choosing OpenAI format for it maximizes compatibility at zero extra cost.

---

## 5. Screens

### Screen 1: First-Run Setup

**Who:** Host only, once.
**When:** No admin account exists yet.

The setup wizard should take under 60 seconds. Model downloading happens later from the Dashboard, not during setup (model pulls can take 5-30 minutes -- trapping the user in a wizard during that wait is bad UX).

**Step 1 -- Welcome**

- Fire logo + "Welcome to Fireside"
- "Set up your private AI server in under a minute."
- "Get Started" button

**Step 2 -- Create Your Server**

- Server name field (placeholder: "e.g. Kazem's AI")
- Admin username field
- Password field + confirm password field
- "Create Server" button
- On success: auto-login, redirect to `#/dashboard` where the Getting Started checklist takes over

---

### Screen 2: Login

**Who:** Everyone (host and clients returning).
**When:** Not logged in, setup already complete.

- Fire logo
- Server name as heading (e.g. "Kazem's AI") -- branded per-server
- "Private AI" subtitle
- Username field
- Password field
- "Log In" button
- Error state: red inline message below form (e.g. "Invalid username or password")
- No "Sign up" link -- registration only happens via invite links
- No "Forgot password" -- admin resets from the dashboard
- Subtle note below the form: "Need access? Ask the server admin for an invite link."

The login page shows the server's name so returning users (including the host on a new device) know WHOSE server they're connecting to. This is important -- it should feel personal.

---

### Screen 3: Invite Registration

**Who:** Clients clicking an invite link.
**When:** Navigating to `#/invite/:token`

**Valid invite state:**

- Fire logo
- "You've been invited to [Server Name]!"
- If invite has a label: "This invite was created for [Label]"
- "Create your account to start chatting with AI."
- Username field (placeholder: "Choose a username")
- Password field (placeholder: "Choose a password, min 6 characters")
- "Join [Server Name]" button
- On success: auto-login, redirect to `#/chat`

**Invalid/expired/used invite state:**

- Fire logo
- "This invite link is no longer valid."
- Friendly explanation: "It may have expired or already been used."
- "Contact the person who sent you this link for a new invite."

**Already logged in + visiting invite link:**

- Redirect to `#/chat` with a brief toast: "You already have an account."

**Mobile-first:** Clients will very often click invite links on their phones. This page must have large touch targets, clear hierarchy, and work perfectly at any screen width.

**Why no PIN/activation code:** The invite URL itself IS the authorization (cryptographic token + encryption key in the URL fragment). Adding a separate PIN adds friction without meaningful security gain. The link is already single-use and expiring. This matches how Discord, Slack, and Plex invites work.

---

### Screen 4: Host Dashboard

**Who:** Admin only.
**When:** Admin's default landing page after login.

**Structure:** Single page. Left sidebar for tab navigation. Content area shows the selected tab.

**Sidebar:**

- Server name + fire icon at top
- **Server** section header
  - Overview
  - Models
  - Settings
- **Interfaces** section header
  - Chat
  - API
- Admin username + "Log Out" at bottom

No separate "Open Chat" button in the sidebar. The host accesses the chat UI via a subtle inline link inside the Chat tab content ("Try it yourself →"). This keeps the dashboard focused on management — if the host just wanted to chat with AI personally, they'd use Ollama directly. Fireside's value is in sharing and managing.

---

#### Tab: Overview

- Stats cards:
  - Users: total registered (e.g. "5 users")
  - Messages: count today (e.g. "47 messages today")
  - Models: count available (e.g. "2 models")
  - Active now: current sessions

---

#### Tab: Models

Ollama's API supports: list models (`GET /api/tags`), pull with streaming progress (`POST /api/pull`), delete (`DELETE /api/delete`), list running models (`GET /api/ps`).

**Installed Models section:**

- Card or row per model: name, parameter size, quantization, file size, family
- Status badge: "Loaded" (in memory) vs "Available" (on disk)
- "Delete" button per model (with confirmation)

When a host adds a new model, clients automatically see it in their model selector dropdown the next time they load the chat or start a new conversation. No action needed on the client's side.

**Download a Model section:**

- Text input: "Enter model name (e.g. llama3.2:3b)"
- "Download" button
- When downloading: progress bar with bytes transferred / total, estimated time

**Ollama not available:**

Fireside manages Ollama automatically. On first run, if Ollama is not detected, Fireside downloads and installs it silently in the background (or as part of the setup flow). The host should never need to install Ollama manually.

If Ollama's process crashes or stops for some reason:
- Dashboard shows: "AI engine is not running. Restarting..." (auto-restart attempt)
- If restart fails: "Could not start the AI engine. Check that your system meets the requirements." + link to troubleshooting docs

---

#### Tab: Chat (under INTERFACES)

This tab manages everything related to the built-in chat interface: who has access, inviting new people, and a link to try it yourself.

**Intro line:** "Fireside includes a built-in chat interface. [Try it yourself →](#/chat)" — subtle link to the chat UI. Not a big button.

**Users section:**

- Table of everyone with a chat account on the server
- Columns: Username, Role (Admin / User badge), Joined
- Admin user shown first
- Empty state (only admin): "Only you so far. Invite someone below."

**Invite Someone section:**

- Expires in dropdown (7 days default, 1 hour, 24 hours, 30 days, never)
- "Create Invite Link" button
- **Invites are always single-use.** One invite = one person. No max_uses dropdown. This is simpler and more traceable. The host creates an invite, gives it to one specific person, they register, it's consumed.

**After creation -- highlighted box:**

- "Send this link to your friend:"
- The invite URL (readonly input, monospace font)
- "Copy" button

**Pending invites list:**

- Table of created invites
- Columns: Invite (token prefix), Status (Pending / Used / Expired), Expires, Created
- "Revoke" button on pending invites only
- Used/expired invites shown grayed out

**Why combined:** An invite is just "a user who hasn't registered yet." Having invites and users as separate pages was artificial. One page that shows registered users at the top and invite management below is the natural mental model.

---

#### Tab: API (under INTERFACES)

API keys are a core feature, not just an admin utility. They let anyone the host trusts connect any OpenAI-compatible tool to this server. API keys are independent of user accounts — the recipient doesn't need to register.

**Intro line:** "Give anyone an API key to connect external tools — Cursor, Python, or anything that speaks the OpenAI format. No account needed."

**Create API Key section:**

- Name field (placeholder: "e.g. my-laptop, sarah-cursor")
- "Create Key" button

**After creation -- highlighted warning box:**

- "Save this key now — it won't be shown again."
- Key in monospace readonly input
- "Copy" button
- Quick-start usage examples (tabbed or stacked):
  - **Python:** `openai.OpenAI(base_url="https://your-server/v1", api_key="sk-...")`
  - **Cursor/IDE:** "Set base URL to `https://your-server/v1` and paste the API key."
  - **curl:** `curl https://your-server/v1/chat/completions -H "Authorization: Bearer sk-..."`

**Active Keys table:**

- Columns: Name, Key Prefix (sk-abc1...), Last Used, Created
- "Revoke" button per row
- Empty state: "No API keys yet."

**Sharing API keys:** The host can create a key, name it after the recipient (e.g. "sarah-cursor"), and send it to them directly. This gives the recipient API access without them needing a Fireside account. The two access paths (Chat UI via invite, API via key) are completely independent.

---

#### Tab: Settings (under SERVER)

- **Server Name** — editable + Save button
- **Tunnel URL** — for Cloudflare Tunnel, so invite links use the public URL instead of localhost. Text input + Save.
- **Change Password** — current password, new password fields + Update button
- **Reset Server** — wipes the database (users, conversations, invites, API keys, config) and returns to the setup wizard. Big red button with confirmation dialog: "This will erase all data and start fresh. This cannot be undone." This is the host's "start over" mechanism. Without it, the only option after logging out is to log back in — there's no way to re-run setup with a new name/account.

---

### Screen 5: Chat Interface

**Who:** All authenticated users (host and clients).
**When:** Client's default view. Host accesses via "Try it yourself →" link in the Chat tab of the dashboard.

**Left sidebar:**

- Server name + fire icon at top
- "New Chat" button
- Conversation list (sorted by most recent):
  - Title (first ~40 chars of first message)
  - Delete button (visible on hover, always visible on mobile)
  - Active conversation highlighted
- Footer:
  - Username display
  - For admin only: "Dashboard" link (navigates to `#/dashboard`)
  - "Log Out" link
- On mobile: sidebar hidden by default, toggle via hamburger icon

**Main area -- Header:**

- Model selector dropdown (shows model name + parameter size)
- If no models available: dropdown disabled, shows "No models"

**Main area -- Welcome state** (no active conversation):

- Fire logo (large)
- "How can I help you?"

**Main area -- Active conversation:**

- Messages in chronological order, each with:
  - Avatar (user icon for human, fire icon for AI)
  - Role label ("You" / "AI")
  - Message content with markdown rendering:
    - Bold, italic, headers
    - Code blocks with syntax highlighting + "Copy" button
    - Inline code, lists, links (open in new tab)
  - Streaming: assistant messages appear token-by-token with a blinking cursor
- Input area at bottom:
  - Auto-resizing textarea
  - Send button (arrow icon)
  - Enter to send, Shift+Enter for new line
  - Disabled while streaming

**Edge cases:**

- AI engine not running: "AI is not available right now." (client) / "Go to Dashboard > Models to check." (admin)
- No models downloaded: "No AI models available yet." (client) / "Go to Dashboard > Models to download one." (admin)
- Model busy: Ollama queues requests. If delay > 30s, show: "The AI is processing other requests. Yours is queued."
- Session expired: redirect to login with "Your session has expired. Please log in again."
- Username taken during registration: "That username is already taken. Try a different one."

---

## 6. User Flows

### Flow A: Host First Run (Solo Use)

```
1. Downloads Fireside from getfireside.com (single binary)
2. Runs: ./fireside
3. Fireside auto-detects Ollama. If missing, downloads and starts it.
4. Terminal: "Fireside running at http://localhost:7654"
5. Opens browser to localhost:7654
6. Setup Step 1: Welcome screen. Clicks "Get Started"
7. Setup Step 2: enters server name, username, password
8. Clicks "Create Server" -> auto-login -> #/dashboard (Overview shows stats)
9. Clicks Models tab (under Server), picks a model, clicks Download. Progress bar.
10. Model ready. Clicks Chat tab -> "Try it yourself" link
11. Chats with AI from their desktop.
12. Later, opens the same URL on their phone -> login -> same conversations, picks up where they left off.
13. Creates an API key, configures Cursor to use it. Now has AI in their IDE too.
```

### Flow B: Host Invites a Friend

```
1. Host is on Dashboard
2. Clicks Chat tab (under Interfaces)
3. Scrolls to "Invite Someone", picks expiry (7 days)
4. Clicks "Create Invite Link"
5. Copies the invite URL
6. Sends it to Sarah via text/Discord/email
```

### Flow C: Client Joins

```
1. Sarah gets a text: "Try my private AI! [invite link]"
2. Clicks link on her phone
3. Browser opens to: ai.kazem.com/#/invite/abc123...
4. Sees: "You've been invited to Kazem's AI!"
5. Enters username: "sarah", password: "mypass123"
6. Clicks "Join Kazem's AI"
7. Auto-login -> #/chat
8. Sees welcome screen, types a message, sees streaming AI response
9. Done. Next time: visits same URL, logs in normally. Works from any device.
```

### Flow D: Host Day-to-Day

```
1. Visits localhost:7654 -> auto-login -> #/dashboard
2. Overview: 3 users, 24 messages today, 2 models
3. Clicks Chat tab to see users, Sarah's last activity
4. Downloads a new model from Models tab
5. Clicks "Try it yourself" link in Chat tab to test the new model
6. Chats. Clicks "Dashboard" in chat sidebar to go back.
```

### Flow E: API Key Usage (Host)

```
1. Dashboard > API tab (under Interfaces)
2. Creates key "cursor-ide", copies it
3. Configures tool:
   base_url = "https://ai.kazem.com/v1"
   api_key = "sk-..."
4. Tool sends requests to /v1/chat/completions
5. "Last Used" updates in API Keys tab
```

### Flow F: Sharing API Access with a Friend

```
1. Host's developer friend asks to connect from their IDE
2. Host goes to Dashboard > API tab (under Interfaces)
3. Creates key named "sarah-cursor", copies it
4. Sends the key + server URL to the friend:
   "Base URL: https://ai.kazem.com/v1, API key: sk-..."
5. Friend configures their tool and starts using the API
6. Host can see "Last Used" updating in the API Keys tab
7. If needed, host can revoke the key at any time
```

---

## 7. Error States

**Ollama / AI engine issues:**

Fireside manages Ollama automatically. If it crashes, Fireside attempts auto-restart. If restart fails: "The AI engine encountered an issue. Check troubleshooting docs."

**No models downloaded:**

- Client chat: "No AI models available yet. Ask the server admin to set one up."
- Admin chat: "No models available. Go to Dashboard > Models to download one."

**Model download fails:**

- Models tab: "Download failed. Check the model name and your internet connection." + Retry button

**Concurrent users:**

- Ollama queues requests internally. Users see a "thinking..." indicator.
- If > 30s delay: "The AI is processing other requests. Yours is queued."

**Server offline when client clicks invite:**

- Browser shows a generic connection error. Docs explain the host's server must be running.

**Session expiry:**

- Next API call returns 401 -> redirect to login with "Session expired, please log in again."
