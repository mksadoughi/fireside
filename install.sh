#!/bin/sh
# Fireside install script
# Usage: curl -fsSL https://fireside.run/install | sh
set -e

FIRESIDE_VERSION="${FIRESIDE_VERSION:-latest}"
INSTALL_DIR="/usr/local/bin"
SERVICE_NAME="fireside"
PORT=7654

# ── Colours ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { printf "${GREEN}[fireside]${NC} %s\n" "$*"; }
warn()    { printf "${YELLOW}[fireside]${NC} %s\n" "$*"; }
error()   { printf "${RED}[fireside] error:${NC} %s\n" "$*" >&2; exit 1; }

# ── Platform detection ─────────────────────────────────────────────────────────
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$ARCH" in
    x86_64)         ARCH="amd64" ;;
    aarch64|arm64)  ARCH="arm64" ;;
    *)              error "Unsupported architecture: $ARCH. Supported: x86_64, arm64." ;;
esac

case "$OS" in
    darwin|linux) ;;
    *) error "Unsupported OS: $OS. Supported: macOS and Linux." ;;
esac

info "Detected: $OS/$ARCH"

# ── Helpers ────────────────────────────────────────────────────────────────────
need_sudo() {
    if [ "$(id -u)" -ne 0 ] && ! sudo -n true 2>/dev/null; then
        info "Some steps require sudo. You may be prompted for your password."
    fi
}

download() {
    url="$1"
    dest="$2"
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$url" -o "$dest"
    elif command -v wget >/dev/null 2>&1; then
        wget -qO "$dest" "$url"
    else
        error "curl or wget is required to download files."
    fi
}

# ── Install Ollama ─────────────────────────────────────────────────────────────
install_ollama() {
    if command -v ollama >/dev/null 2>&1; then
        info "Ollama already installed: $(ollama --version 2>/dev/null || echo 'ok')"
        return
    fi

    info "Installing Ollama..."
    curl -fsSL https://ollama.ai/install.sh | sh
    info "Ollama installed."
}

# ── Install cloudflared ────────────────────────────────────────────────────────
install_cloudflared() {
    if command -v cloudflared >/dev/null 2>&1; then
        info "cloudflared already installed."
        return
    fi

    info "Installing cloudflared..."

    CF_BASE="https://github.com/cloudflare/cloudflared/releases/latest/download"

    if [ "$OS" = "darwin" ]; then
        CF_BIN="cloudflared-darwin-$ARCH"
    else
        CF_BIN="cloudflared-linux-$ARCH"
    fi

    TMP=$(mktemp)
    download "$CF_BASE/$CF_BIN" "$TMP"
    chmod +x "$TMP"
    sudo mv "$TMP" "$INSTALL_DIR/cloudflared"
    info "cloudflared installed."
}

# ── Install Fireside binary ────────────────────────────────────────────────────
install_fireside() {
    if [ "$FIRESIDE_VERSION" = "latest" ]; then
        RELEASE_URL="https://github.com/fireside-ai/fireside/releases/latest/download"
    else
        RELEASE_URL="https://github.com/fireside-ai/fireside/releases/download/$FIRESIDE_VERSION"
    fi

    BINARY_NAME="fireside-$OS-$ARCH"
    info "Downloading Fireside ($BINARY_NAME)..."

    TMP=$(mktemp)
    download "$RELEASE_URL/$BINARY_NAME" "$TMP"
    chmod +x "$TMP"
    sudo mv "$TMP" "$INSTALL_DIR/fireside"
    info "Fireside installed to $INSTALL_DIR/fireside."
}

# ── Register as system service ────────────────────────────────────────────────
register_service_macos() {
    PLIST="$HOME/Library/LaunchAgents/run.fireside.plist"
    if [ -f "$PLIST" ]; then
        warn "LaunchAgent already exists at $PLIST. Skipping service registration."
        return
    fi

    mkdir -p "$HOME/Library/LaunchAgents"
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>run.fireside</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/fireside</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$HOME/.fireside/fireside.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/.fireside/fireside.log</string>
</dict>
</plist>
EOF

    launchctl load "$PLIST"
    info "Fireside registered as a LaunchAgent (starts on login)."
}

register_service_linux() {
    SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
    if [ -f "$SERVICE_FILE" ]; then
        warn "Systemd service already exists. Skipping service registration."
        return
    fi

    sudo tee "$SERVICE_FILE" >/dev/null <<EOF
[Unit]
Description=Fireside — Private AI Server
After=network.target

[Service]
ExecStart=$INSTALL_DIR/fireside
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable --now "$SERVICE_NAME"
    info "Fireside registered as a systemd service (starts on boot)."
}

# ── Wait for server ready ─────────────────────────────────────────────────────
wait_for_server() {
    info "Waiting for Fireside to start..."
    i=0
    while [ $i -lt 30 ]; do
        if curl -sf "http://localhost:$PORT/health" >/dev/null 2>&1; then
            info "Fireside is ready."
            return
        fi
        sleep 1
        i=$((i + 1))
    done
    warn "Fireside didn't respond within 30 seconds. Check logs at ~/.fireside/fireside.log"
}

open_browser() {
    URL="http://localhost:$PORT"
    info "Opening $URL in your browser..."
    case "$OS" in
        darwin) open "$URL" ;;
        linux)  xdg-open "$URL" 2>/dev/null || true ;;
    esac
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
    echo ""
    echo "  🔥  Fireside — Private AI Server"
    echo "  ─────────────────────────────────"
    echo ""

    need_sudo
    mkdir -p "$HOME/.fireside"

    install_ollama
    install_cloudflared
    install_fireside

    if [ "$OS" = "darwin" ]; then
        register_service_macos
    else
        register_service_linux
    fi

    wait_for_server
    open_browser

    echo ""
    info "Done! Fireside is running at http://localhost:$PORT"
    info "The setup page will open in your browser."
    echo ""
}

main
