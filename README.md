<img src="website/public/logo.svg" alt="" width="64" height="64" align="right" />

# Fireside

A self-hosted AI platform. Install it on your computer, and it becomes a private AI server that your family and friends can access from any device through a browser — no setup on their end.

Think of it like Plex, but for AI.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Website](https://img.shields.io/badge/Website-fireside.run-ff6b00)](https://fireside.run)
[![Docs](https://img.shields.io/badge/Docs-Getting_Started-00e5ff)](https://fireside.run/docs/getting-started)

## Install

```bash
curl -fsSL https://fireside.run/install | sh
```

Runs on macOS and Linux. The installer handles everything — including Ollama for running AI models. After installing, your browser opens to `http://localhost:7654` and a setup wizard walks you through the rest.

## What it does

- **Chat in the browser** — clean UI that works on phones, tablets, and desktops. Your users just open a link.
- **Private by design** — AI models run on your machine. Messages are encrypted (AES-256-GCM) before they leave the browser. Nothing is sent to any third party.
- **Share with a link** — generate single-use invite links. Each invite establishes a unique encryption key automatically.
- **OpenAI-compatible API** — works with LangChain, Open WebUI, Cursor, and anything that speaks the OpenAI format.
- **Single binary** — no Docker, no containers, no config files. One command to install, one file to run.

## Building from Source

Prerequisites: Go 1.25+, Node 20+.

```bash
git clone https://github.com/mksadoughi/fireside.git
cd fireside
make build    # builds UI + Go binary
./fireside    # start the server
```

For development with hot-reload:

```bash
make dev
```

## Testing

We have three layers of tests:

- **Go tests** — unit and integration tests for the server. No running server needed.
- **Smoke tests** — bash script that exercises the HTTP API end-to-end against a running server.
- **Python integration tests** — pytest suite covering auth flows, password changes, LangChain, and the OpenAI-compatible API.

```bash
go test ./server/ -v

./tests/smoke.sh http://localhost:7654

pip install -r integration_tests/requirements.txt
pytest integration_tests/api/ -v
```

## License

[AGPL-3.0](LICENSE)
