# Fireside

A self-hosted AI server that lets you share your GPU with family and friends. One install, one URL, private conversations.

## Project Structure

```
docs/       → Product spec, architecture, detailed design
server/     → Go backend (core server)
ui/         → Chat UI (custom HTML/CSS/JS, Phase 2)
sdk/        → Python/Node SDK (Phase 3)
website/    → Public website (Phase 5)
```

## Quick Start (Development)

```bash
# Prerequisites: Go 1.22+, Ollama running on localhost:11434

cd server
go run . --port 3000
```

## Documentation

- [Product Spec](docs/product-spec.md) — What it is, who it's for
- [Architecture](docs/architecture.md) — System design, API contracts
- [Detailed Design](docs/detailed-design.md) — Schema, auth, encryption
- [Tech Plan](docs/tech-plan.md) — Build phases, tech stack
