package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

// OpenAI-compatible request/response types.
// These match the format that the Python openai client, LangChain, Cursor, etc. expect.

type openAIRequest struct {
	Model            string        `json:"model"`
	Messages         []ChatMessage `json:"messages"`
	Stream           bool          `json:"stream"`
	Temperature      *float64      `json:"temperature,omitempty"`
	MaxTokens        *int          `json:"max_tokens,omitempty"`
	MaxCompTokens    *int          `json:"max_completion_tokens,omitempty"`
	TopP             *float64      `json:"top_p,omitempty"`
	Stop             any           `json:"stop,omitempty"`
	FrequencyPenalty *float64      `json:"frequency_penalty,omitempty"`
	PresencePenalty  *float64      `json:"presence_penalty,omitempty"`
	N                *int          `json:"n,omitempty"`
}

type openAIResponse struct {
	ID      string           `json:"id"`
	Object  string           `json:"object"`
	Created int64            `json:"created"`
	Model   string           `json:"model"`
	Choices []openAIChoice   `json:"choices"`
	Usage   *openAIUsage     `json:"usage,omitempty"`
}

type openAIChoice struct {
	Index        int              `json:"index"`
	Message      *openAIMessage   `json:"message,omitempty"`
	Delta        *openAIMessage   `json:"delta,omitempty"`
	FinishReason *string          `json:"finish_reason"`
}

type openAIMessage struct {
	Role    string `json:"role,omitempty"`
	Content string `json:"content,omitempty"`
}

type openAIUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type openAIModelsResponse struct {
	Object string          `json:"object"`
	Data   []openAIModel   `json:"data"`
}

type openAIModel struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	OwnedBy string `json:"owned_by"`
}

func generateCompletionID() string {
	b, _ := randomHex(12)
	return "chatcmpl-" + b
}

// handleOpenAIChatCompletions handles POST /v1/chat/completions
func handleOpenAIChatCompletions(db *DB, ollama *OllamaClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req openAIRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeOpenAIError(w, http.StatusBadRequest, "invalid_request_error", "Could not parse request body.")
			return
		}

		if req.Model == "" {
			writeOpenAIError(w, http.StatusBadRequest, "invalid_request_error", "Missing required parameter: 'model'.")
			return
		}
		if len(req.Messages) == 0 {
			writeOpenAIError(w, http.StatusBadRequest, "invalid_request_error", "Missing required parameter: 'messages'.")
			return
		}

		completionID := generateCompletionID()
		created := time.Now().Unix()

		if req.Stream {
			handleOpenAIStream(w, ollama, &req, completionID, created)
		} else {
			handleOpenAINonStream(w, ollama, &req, completionID, created)
		}
	}
}

func handleOpenAINonStream(w http.ResponseWriter, ollama *OllamaClient, req *openAIRequest, id string, created int64) {
	resp, err := ollama.Chat(req.Model, req.Messages)
	if err != nil {
		log.Printf("Ollama error: %v", err)
		writeOpenAIError(w, http.StatusBadGateway, "server_error", fmt.Sprintf("Model inference failed: %v", err))
		return
	}

	finishReason := "stop"
	result := openAIResponse{
		ID:      id,
		Object:  "chat.completion",
		Created: created,
		Model:   req.Model,
		Choices: []openAIChoice{
			{
				Index:        0,
				Message:      &openAIMessage{Role: "assistant", Content: resp.Message.Content},
				FinishReason: &finishReason,
			},
		},
		Usage: &openAIUsage{
			PromptTokens:     0,
			CompletionTokens: 0,
			TotalTokens:      0,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func handleOpenAIStream(w http.ResponseWriter, ollama *OllamaClient, req *openAIRequest, id string, created int64) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeOpenAIError(w, http.StatusInternalServerError, "server_error", "Streaming not supported.")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	// First chunk: send the role
	firstChunk := openAIResponse{
		ID:      id,
		Object:  "chat.completion.chunk",
		Created: created,
		Model:   req.Model,
		Choices: []openAIChoice{
			{
				Index:        0,
				Delta:        &openAIMessage{Role: "assistant"},
				FinishReason: nil,
			},
		},
	}
	data, _ := json.Marshal(firstChunk)
	fmt.Fprintf(w, "data: %s\n\n", data)
	flusher.Flush()

	err := ollama.ChatStream(req.Model, req.Messages, func(chunk StreamChunk) error {
		if chunk.Done {
			return nil
		}

		streamChunk := openAIResponse{
			ID:      id,
			Object:  "chat.completion.chunk",
			Created: created,
			Model:   req.Model,
			Choices: []openAIChoice{
				{
					Index:        0,
					Delta:        &openAIMessage{Content: chunk.Content},
					FinishReason: nil,
				},
			},
		}
		data, _ := json.Marshal(streamChunk)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
		return nil
	})

	if err != nil {
		log.Printf("Stream error: %v", err)
		return
	}

	// Final chunk: finish_reason = "stop"
	finishReason := "stop"
	finalChunk := openAIResponse{
		ID:      id,
		Object:  "chat.completion.chunk",
		Created: created,
		Model:   req.Model,
		Choices: []openAIChoice{
			{
				Index:        0,
				Delta:        &openAIMessage{},
				FinishReason: &finishReason,
			},
		},
	}
	data, _ = json.Marshal(finalChunk)
	fmt.Fprintf(w, "data: %s\n\n", data)
	flusher.Flush()

	fmt.Fprint(w, "data: [DONE]\n\n")
	flusher.Flush()
}

// handleOpenAIListModels handles GET /v1/models
func handleOpenAIListModels(ollama *OllamaClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		models, err := ollama.ListModels()
		if err != nil {
			writeOpenAIError(w, http.StatusBadGateway, "server_error", "Failed to list models.")
			return
		}

		var data []openAIModel
		for _, m := range models {
			data = append(data, openAIModel{
				ID:      m.Name,
				Object:  "model",
				Created: m.ModifiedAt.Unix(),
				OwnedBy: "local",
			})
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(openAIModelsResponse{
			Object: "list",
			Data:   data,
		})
	}
}

func writeOpenAIError(w http.ResponseWriter, status int, errType, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]any{
		"error": map[string]any{
			"message": message,
			"type":    errType,
		},
	})
}
