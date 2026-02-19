package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// OllamaClient talks to the local Ollama HTTP API.
type OllamaClient struct {
	BaseURL    string
	HTTPClient *http.Client
}

func NewOllamaClient(baseURL string) *OllamaClient {
	return &OllamaClient{
		BaseURL: baseURL,
		HTTPClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

// Model represents a model from Ollama's /api/tags response.
type Model struct {
	Name       string    `json:"name"`
	Model      string    `json:"model"`
	Size       int64     `json:"size"`
	ModifiedAt time.Time `json:"modified_at"`
	Details    struct {
		Family        string `json:"family"`
		ParameterSize string `json:"parameter_size"`
		QuantLevel    string `json:"quantization_level"`
	} `json:"details"`
}

type ollamaTagsResponse struct {
	Models []Model `json:"models"`
}

// ListModels returns all models Ollama has downloaded.
func (c *OllamaClient) ListModels() ([]Model, error) {
	resp, err := c.HTTPClient.Get(c.BaseURL + "/api/tags")
	if err != nil {
		return nil, fmt.Errorf("connecting to Ollama: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Ollama returned %d: %s", resp.StatusCode, body)
	}

	var result ollamaTagsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decoding Ollama response: %w", err)
	}
	return result.Models, nil
}

// ChatMessage is a single message in a conversation (user, assistant, or system).
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatRequest is what our server accepts from clients.
type ChatRequest struct {
	Model    string        `json:"model"`
	Messages []ChatMessage `json:"messages"`
}

// ChatResponse is the non-streaming response we return.
type ChatResponse struct {
	Model   string      `json:"model"`
	Message ChatMessage `json:"message"`
}

type ollamaChatRequest struct {
	Model    string        `json:"model"`
	Messages []ChatMessage `json:"messages"`
	Stream   bool          `json:"stream"`
}

type ollamaChatResponse struct {
	Message ChatMessage `json:"message"`
	Done    bool        `json:"done"`
}

// Chat sends a non-streaming chat request to Ollama and returns the full response.
func (c *OllamaClient) Chat(model string, messages []ChatMessage) (*ChatResponse, error) {
	reqBody := ollamaChatRequest{
		Model:    model,
		Messages: messages,
		Stream:   false,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshaling request: %w", err)
	}

	// No timeout for inference -- it can take a while on slower hardware
	client := &http.Client{Timeout: 0}
	resp, err := client.Post(c.BaseURL+"/api/chat", "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("calling Ollama: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Ollama returned %d: %s", resp.StatusCode, body)
	}

	var ollamaResp ollamaChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&ollamaResp); err != nil {
		return nil, fmt.Errorf("decoding Ollama response: %w", err)
	}

	return &ChatResponse{
		Model:   model,
		Message: ollamaResp.Message,
	}, nil
}

// StreamChunk is one piece of a streaming response.
type StreamChunk struct {
	Content string `json:"content"`
	Done    bool   `json:"done"`
}

// ChatStream sends a streaming chat request. It calls onChunk for each token
// as it arrives from Ollama. The final chunk has Done=true.
func (c *OllamaClient) ChatStream(model string, messages []ChatMessage, onChunk func(StreamChunk) error) error {
	reqBody := ollamaChatRequest{
		Model:    model,
		Messages: messages,
		Stream:   true,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("marshaling request: %w", err)
	}

	client := &http.Client{Timeout: 0}
	resp, err := client.Post(c.BaseURL+"/api/chat", "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		return fmt.Errorf("calling Ollama: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Ollama returned %d: %s", resp.StatusCode, body)
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var ollamaResp ollamaChatResponse
		if err := json.Unmarshal(line, &ollamaResp); err != nil {
			continue
		}

		chunk := StreamChunk{
			Content: ollamaResp.Message.Content,
			Done:    ollamaResp.Done,
		}
		if err := onChunk(chunk); err != nil {
			return err
		}
	}

	return scanner.Err()
}
