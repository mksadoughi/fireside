BINARY  := fireside
PKG     := ./server
DIST    := dist

.PHONY: build build-all clean run

# Default: build for current platform
build:
	go build -o $(BINARY) $(PKG)

# Run the server locally (no tunnel — faster dev loop)
run:
	go run $(PKG) --no-tunnel

# Cross-compile for all release targets
build-all: $(DIST)/$(BINARY)-darwin-arm64 \
           $(DIST)/$(BINARY)-darwin-amd64 \
           $(DIST)/$(BINARY)-linux-amd64  \
           $(DIST)/$(BINARY)-linux-arm64  \
           $(DIST)/$(BINARY)-windows-amd64.exe

$(DIST)/$(BINARY)-darwin-arm64: $(shell find server -name '*.go') $(shell find ui -type f)
	@mkdir -p $(DIST)
	GOOS=darwin  GOARCH=arm64 go build -o $@ $(PKG)
	@echo "Built $@"

$(DIST)/$(BINARY)-darwin-amd64: $(shell find server -name '*.go') $(shell find ui -type f)
	@mkdir -p $(DIST)
	GOOS=darwin  GOARCH=amd64 go build -o $@ $(PKG)
	@echo "Built $@"

$(DIST)/$(BINARY)-linux-amd64: $(shell find server -name '*.go') $(shell find ui -type f)
	@mkdir -p $(DIST)
	GOOS=linux   GOARCH=amd64 go build -o $@ $(PKG)
	@echo "Built $@"

$(DIST)/$(BINARY)-linux-arm64: $(shell find server -name '*.go') $(shell find ui -type f)
	@mkdir -p $(DIST)
	GOOS=linux   GOARCH=arm64 go build -o $@ $(PKG)
	@echo "Built $@"

$(DIST)/$(BINARY)-windows-amd64.exe: $(shell find server -name '*.go') $(shell find ui -type f)
	@mkdir -p $(DIST)
	GOOS=windows GOARCH=amd64 go build -o $@ $(PKG)
	@echo "Built $@ (binary only — install script not yet supported on Windows)"

clean:
	rm -rf $(DIST) $(BINARY)
