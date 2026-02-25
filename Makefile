.PHONY: all build dev website clean web-build ui-build serve

# Default target
all: build

# Development Mode
# Runs both the Go backend and the Vite frontend with hot-reload
dev:
	@echo "Starting development environment..."
	@cd app-ui && npm run dev & \
	cd server && go run . --port 7654

# Start the marketing website
website:
	@echo "Starting marketing website..."
	@cd website && npm run dev

# Build UI
ui-build:
	@echo "Building frontend UI..."
	@cd app-ui && npm run build

# Build Go Binary (embeds UI)
build: ui-build
	@echo "Building Fireside binary..."
	@go build -o fireside ./server
	@echo "Build complete. Run ./fireside to start."

# Clean build artifacts
clean:
	@echo "Cleaning up..."
	@rm -f fireside
	@rm -rf ui/dist
	@echo "Clean complete."
