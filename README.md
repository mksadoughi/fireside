# Fireside

A self-hosted AI server that lets you share your GPU with family and friends. Chat in the browser or connect any tool via an OpenAI-compatible API. One install, one URL, private conversations.

## Project Structure

```
docs/       → Product spec, architecture, detailed design, UX spec
server/     → Go backend (core server)
ui/         → Chat UI (custom HTML/CSS/JS)
sdk/        → Python/Node SDK (future)
website/    → Public website (future)
```

## Quick Start (Development)

```bash
# Prerequisites: Go 1.22+, Ollama running on localhost:11434

cd server
go run . --port 7654
```

Then open `http://localhost:7654` in your browser.

## Documentation

- [Product Spec](docs/product-spec.md) — What it is, who it's for
- [UX Spec](docs/ux-spec.md) — UI/UX design, screens, user flows
- [Architecture](docs/architecture.md) — System design, API contracts
- [Detailed Design](docs/detailed-design.md) — Schema, auth, encryption
- [Tech Plan](docs/tech-plan.md) — Build phases, tech stack
