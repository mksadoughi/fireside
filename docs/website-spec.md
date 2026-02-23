# Fireside Website Specification (V1)

## Tech Stack & Architecture
- **Framework:** Next.js using `output: "export"` (pure static HTML/CSS/JS generation, no Node.js backend required).
- **Styling:** TailwindCSS + Framer Motion (for premium, buttery-smooth micro-animations).
- **Hosting:** Cloudflare Pages (Free, infinite global edge caching).
- **Directory:** `/website` at the root of the repository.

## Design Aesthetic
The website needs to visually differentiate Fireside from open-source hobby projects. It should exude trust, security, and developer polish.
- **Theme:** Dark mode by default (sleek, hacker-friendly, private).
- **Typography:** Modern sans-serif (Inter or Geist).
- **Colors:** Deep obsidian backgrounds with vibrant, glowing accent colors (e.g., fiery orange/amber mixed with electric blue) to represent the "Fireside" theme and encryption.
- **Vibe:** "The Signal of AI" — cryptographically secure, magically easy to install, strictly local.

## Core Pages (V1)

### 1. Landing Page (`/`)
The goal is to convert visitors within 30 seconds of scrolling.
- **Hero Section:**
  - *Goal: Explain exactly what it is in 3 seconds. No fluff.*
  - Idea 1: "Host your own AI. Share it with a link."
  - Idea 2: "The private AI server for your family and friends."
  - Idea 3: "Run open-source AI locally. Share it securely."
  - Subheadline: "One command to install. Zero config. End-to-end encrypted."
  - Call to Action (CTA): A prominent, copyable terminal block: `curl -fsSL https://fireside.run/install | sh`
- **Features Grid:**
  - **Truly Private:** AES-256-GCM encryption built-in. Only you have the keys.
  - **API First:** Drop-in OpenAI `/v1/` compatibility for Cursor, LangChain, and Open WebUI.
  - **No Sweaty Config:** Automatically downloads Ollama, routes Cloudflare tunnels, and serves the UI.
  - **Multiplayer:** Invite friends and family securely.
- **Demo/Preview:** A scrolling code snippet comparing an OpenAI request to a Fireside API request, instantly showcasing the drop-in compatibility.
- **Footer:** Links to Github, Privacy Policy, Docs.

### 2. Documentation / Docs (`/docs`)
A beautifully rendered, easily navigable markdown-driven section.
- **Getting Started:** Installation on Mac/Linux.
- **API Reference:** How to connect Cursor, Python SDK, etc., with code examples.
- **Security Model:** Clear, honest matrix of what is encrypted (Chat UI) vs what relies on TLS (V1 API endpoint), building immense technical trust.

### 3. Pricing / The Future (`/connect`)
An honest roadmap page explaining the V1 (Free) vs V2 (Paid) models.
- **Free:** Cloudflare random tunnels, self-hosted. 
- **Fireside Connect (Coming Soon):** The $8/mo managed relay for permanent `name.fireside.run` subdomains and true end-to-end API encryption. Email capture form for the waitlist.

## Component Library Needs
- **Terminal Window:** A stylized, macOS-like terminal component for the install command.
- **Code Block Matcher:** Syntax-highlighted code blocks with a one-click "Copy" button.
- **Feature Cards:** Glassmorphic layout for dropping in feature icons and descriptions. 
