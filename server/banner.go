package main

import (
	"fmt"
	"net/http"
	"time"
)

// ANSI colours
const (
	bold   = "\033[1m"
	dim    = "\033[2m"
	orange = "\033[38;5;208m"
	cyan   = "\033[38;5;45m"
	green  = "\033[0;32m"
	red    = "\033[0;31m"
	nc     = "\033[0m"
)

// printStartupBanner displays a clean, branded startup message.
// Internal details are only shown with --verbose.
func printStartupBanner(db *DB, ollama *OllamaClient, port int, verbose bool, tunnelURL string) {
	url := fmt.Sprintf("http://localhost:%d", port)

	setupDone, _ := db.IsSetupComplete()
	ollamaOK := checkOllamaHealth(ollama)

	fmt.Println()
	fmt.Printf("  %s╭──────────────────────────────╮%s\n", orange, nc)
	fmt.Printf("  %s│%s                              %s│%s\n", orange, nc, orange, nc)
	fmt.Printf("  %s│%s %s%s█▀▀ █ █▀█ █▀▀ █▀▀ █ █▀▄ █▀▀%s %s│%s\n", orange, nc, orange, bold, nc, orange, nc)
	fmt.Printf("  %s│%s %s%s█▀  █ █▀▄ ██▄ ▄▀█ █ █▄▀ ██▄%s %s│%s\n", orange, nc, orange, bold, nc, orange, nc)
	fmt.Printf("  %s│%s                              %s│%s\n", orange, nc, orange, nc)
	fmt.Printf("  %s╰──────────────────────────────╯%s\n", orange, nc)

	if setupDone {
		serverName, _ := db.GetConfig("server_name")
		if serverName != "" {
			fmt.Printf("  %s%s%s is running\n", bold, serverName, nc)
		}
	}

	fmt.Println()

	if setupDone {
		fmt.Printf("  Dashboard   %s%s%s\n", cyan, url, nc)
	} else {
		fmt.Printf("  Setup       %s%s%s\n", cyan, url, nc)
	}

	if tunnelURL != "" {
		fmt.Printf("  Sharing     %s%s%s\n", cyan, tunnelURL, nc)
	}

	fmt.Println()

	if ollamaOK {
		fmt.Printf("  %s✓%s AI engine\n", green, nc)
	} else {
		fmt.Printf("  %s✗%s AI engine\n", red, nc)
	}

	if tunnelURL != "" {
		fmt.Printf("  %s✓%s Tunnel\n", green, nc)
	} else {
		fmt.Printf("  %s-%s Tunnel%s\n", dim, nc, nc)
	}

	fmt.Println()
	fmt.Printf("  %sPress Ctrl+C to stop%s\n", dim, nc)
	fmt.Println()

	if verbose {
		fmt.Printf("  %s--- Debug ---%s\n", dim, nc)
		fmt.Printf("  %sOllama: %s%s\n", dim, ollama.BaseURL, nc)
		fmt.Printf("  %sPort:   %d%s\n", dim, port, nc)
		fmt.Println()
	}
}

// checkOllamaHealth pings Ollama to see if it's reachable.
func checkOllamaHealth(ollama *OllamaClient) bool {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(ollama.BaseURL + "/api/tags")
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}
