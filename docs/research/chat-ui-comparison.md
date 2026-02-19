# Chat UI Comparison — Research (Feb 2026)

Evaluated open-source chatbot UIs for Fireside's embedded chat interface. The UI must be: lightweight enough to embed in a Go binary, work as a PWA, be mobile-responsive, and look premium.

---

## Candidates

### NextChat (ChatGPT-Next-Web) ✅ **CHOSEN**

- **GitHub:** 87k+ stars
- **License:** MIT
- **Stack:** React / Next.js / TypeScript
- **Build size:** ~5MB static export
- **PWA:** Yes
- **Mobile:** Responsive, polished

**Why it wins:**
- Can export as static files (`next export`) → embed in Go binary via `embed` package
- Massive community, actively maintained
- Polished UI with dark mode, streaming, markdown rendering
- MIT license allows full commercial forking
- React/Next.js is well-understood, easy to modify

**Forking plan:**
1. Strip unnecessary features (multi-provider support, Azure/Google integrations)
2. Replace auth with Fireside auth (session cookies, invite flow)
3. Add encryption layer (Web Crypto API encrypt/decrypt in message handlers)
4. Rebrand (Fireside logo, colors, trust indicator footer)
5. Export as static, embed in Go binary

---

### Open WebUI ❌ Rejected

- **GitHub:** 70k+ stars
- **License:** MIT
- **Stack:** SvelteKit frontend + FastAPI (Python) backend
- **Why rejected:** Requires a Python runtime. Cannot embed in a single Go binary. The Python backend is tightly coupled — it's not just a thin frontend. Would require running a separate Python process, defeating the "single binary" goal.

---

### LibreChat ❌ Rejected

- **GitHub:** 25k+ stars
- **License:** MIT
- **Stack:** React / Express / MongoDB
- **Why rejected:** Requires MongoDB and a Node.js Express backend. Too many dependencies. Not embeddable.

---

### MinimalChat ❌ Rejected

- **License:** MIT
- **Stack:** Vanilla JS
- **Why rejected:** Ceased development (July 2025). Project is dead. Too risky to depend on.

---

### QuikChat ❌ Rejected

- **Stack:** Vanilla JavaScript, zero dependencies
- **Why rejected:** Too basic. No PWA support. No conversation history UI. Wouldn't pass the "hero factor" test — Hosts wouldn't be proud to share this with their families.

---

## Decision Matrix

| Feature | NextChat | Open WebUI | LibreChat | MinimalChat | QuikChat |
|---|---|---|---|---|---|
| Stars | 87k | 70k | 25k | ~2k | ~500 |
| Embeddable in Go | ✅ Static export | ❌ Python backend | ❌ MongoDB + Node | ✅ Static | ✅ Static |
| PWA | ✅ | ✅ | ✅ | ✅ | ❌ |
| Mobile UI | ✅ Polished | ✅ Polished | ✅ Good | ✅ Basic | ❌ Basic |
| Active development | ✅ | ✅ | ✅ | ❌ Dead | ❌ Minimal |
| Look & feel | Premium | Premium | Good | Basic | Basic |
| License | MIT | MIT | MIT | MIT | MIT |

**Recommendation:** Fork **NextChat**. It's the only option that combines a premium look, static export capability, PWA support, and active maintenance.
