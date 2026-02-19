package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"time"
)

func main() {
	port := flag.Int("port", 3000, "port to listen on")
	ollamaURL := flag.String("ollama-url", "http://localhost:11434", "Ollama API base URL")
	flag.Parse()

	ollama := NewOllamaClient(*ollamaURL)

	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("GET /api/models", handleListModels(ollama))
	mux.HandleFunc("POST /api/chat", handleChat(ollama))
	mux.HandleFunc("POST /api/chat/stream", handleChatStream(ollama))

	addr := fmt.Sprintf(":%d", *port)
	server := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 5 * time.Minute,
	}

	log.Printf("Fireside server starting on http://localhost%s", addr)
	log.Printf("Ollama backend: %s", *ollamaURL)
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	})
}

func handleListModels(ollama *OllamaClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		models, err := ollama.ListModels()
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%s"}`, err), http.StatusBadGateway)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"models": models,
		})
	}
}

func handleChat(ollama *OllamaClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req ChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error": "invalid JSON body"}`, http.StatusBadRequest)
			return
		}

		if req.Model == "" {
			http.Error(w, `{"error": "model is required"}`, http.StatusBadRequest)
			return
		}
		if len(req.Messages) == 0 {
			http.Error(w, `{"error": "messages array is required"}`, http.StatusBadRequest)
			return
		}

		resp, err := ollama.Chat(req.Model, req.Messages)
		if err != nil {
			log.Printf("Ollama error: %v", err)
			http.Error(w, fmt.Sprintf(`{"error": "inference failed: %s"}`, err), http.StatusBadGateway)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func handleChatStream(ollama *OllamaClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req ChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error": "invalid JSON body"}`, http.StatusBadRequest)
			return
		}

		if req.Model == "" {
			http.Error(w, `{"error": "model is required"}`, http.StatusBadRequest)
			return
		}
		if len(req.Messages) == 0 {
			http.Error(w, `{"error": "messages array is required"}`, http.StatusBadRequest)
			return
		}

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, `{"error": "streaming not supported"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		err := ollama.ChatStream(req.Model, req.Messages, func(chunk StreamChunk) error {
			data, _ := json.Marshal(chunk)
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
			return nil
		})

		if err != nil {
			log.Printf("Stream error: %v", err)
			fmt.Fprintf(w, "data: {\"error\": \"%s\"}\n\n", err)
			flusher.Flush()
			return
		}

		fmt.Fprintf(w, "data: [DONE]\n\n")
		flusher.Flush()
	}
}
