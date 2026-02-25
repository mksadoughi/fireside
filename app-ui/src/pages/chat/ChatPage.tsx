import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";
import * as api from "@/lib/api";
import { getKey } from "@/lib/keystore";
import { encryptMessage, decryptMessage } from "@/lib/crypto";
import type { Message, Model, Conversation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import {
  Plus,
  Trash2,
  Send,
  Menu,
  X,
  Loader2,
  PauseCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.min.css";
import { UserDropdown } from "@/components/layout/UserDropdown";
import { ThemeToggle } from "@/components/ThemeToggle";

// --- CodeBlock with copy ---
function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const lang = className?.replace("language-", "") || "";
  const code = String(children).replace(/\n$/, "");

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden bg-surface/50 border border-border">
      <div className="flex items-center justify-between px-4 py-1.5 bg-surface border-b border-border text-xs">
        <span className="text-muted font-mono">{lang || "code"}</span>
        <button
          onClick={handleCopy}
          className="text-muted hover:text-foreground transition-colors cursor-pointer"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

// --- Message component ---
function MessageBubble({
  role,
  content,
  userName,
}: {
  role: string;
  content: string;
  userName: string;
}) {
  const isUser = role === "user";

  return (
    <div className={cn("flex gap-3 py-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm",
          isUser ? "bg-fire-orange/20 text-fire-orange" : "bg-surface text-cyan-glow"
        )}
      >
        {isUser ? (userName || "U").charAt(0).toUpperCase() : <Logo className="w-4 h-4" />}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-fire-orange/15 text-foreground"
            : "bg-surface text-foreground"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose-invert prose-sm max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&_pre]:my-0 [&_pre]:bg-transparent [&_pre]:p-0">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                code({ className: codeClassName, children: codeChildren, ...props }) {
                  const isBlock = /language-/.test(codeClassName || "");
                  if (isBlock) {
                    return (
                      <CodeBlock className={codeClassName}>
                        {codeChildren}
                      </CodeBlock>
                    );
                  }
                  return (
                    <code
                      className="bg-surface-hover px-1.5 py-0.5 rounded text-[0.85em] font-mono"
                      {...props}
                    >
                      {codeChildren}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Streaming message (plain text during stream) ---
function StreamingBubble({ text }: { text: string }) {
  return (
    <div className="flex gap-3 py-3">
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-surface text-cyan-glow">
        <Logo className="w-4 h-4" />
      </div>
      <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-surface text-foreground">
        <p className="whitespace-pre-wrap">
          {text}
          <span className="inline-block w-2 h-4 ml-0.5 bg-cyan-glow/70 animate-pulse" />
        </p>
      </div>
    </div>
  );
}

export function ChatPage() {
  const user = useAuthStore((s) => s.user)!;
  const serverInfo = useAuthStore((s) => s.serverInfo);
  const [serverPaused, setServerPaused] = useState(false);

  const {
    conversations,
    currentConversationId,
    messages,
    streamingText,
    isStreaming,
    setConversations,
    setCurrentConversation,
    setMessages,
    addMessage,
    setStreamingText,
    setIsStreaming,
    reset,
  } = useChatStore();

  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [inputText, setInputText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load models
  useEffect(() => {
    (async () => {
      const resp = await api.getModels();
      if (resp.ok) {
        const data = (await resp.json()) as { models: Model[] };
        setModels(data.models || []);
        if (data.models?.length && !selectedModel) {
          setSelectedModel(data.models[0]!.name);
        }
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load conversations
  const loadConversations = useCallback(async () => {
    const resp = await api.getConversations();
    if (resp.ok) {
      const data = (await resp.json()) as { conversations: Conversation[] };
      setConversations(data.conversations || []);
    }
  }, [setConversations]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Check server pause status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const resp = await api.getServerStatus();
        if (resp.ok) {
          const data = (await resp.json()) as { paused: boolean };
          setServerPaused(data.paused);
        }
      } catch {
        // If 503, server is paused
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll on new messages or streaming
  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  // Open conversation
  const openConversation = async (id: number) => {
    setCurrentConversation(id);
    setSidebarOpen(false);
    const resp = await api.getConversation(id);
    if (!resp.ok) return;
    const data = (await resp.json()) as { messages: Message[] };
    const key = await getKey();
    const decrypted: Message[] = [];
    for (const msg of data.messages || []) {
      if (msg.encrypted && key && msg.iv) {
        const text = await decryptMessage(key, msg.iv, msg.content);
        decrypted.push({ ...msg, content: text });
      } else {
        decrypted.push(msg);
      }
    }
    setMessages(decrypted);
  };

  // Delete conversation
  const deleteConv = async (id: number) => {
    await api.deleteConversation(id);
    if (currentConversationId === id) reset();
    loadConversations();
  };

  // New chat
  const startNewChat = () => {
    reset();
    setSidebarOpen(false);
    textareaRef.current?.focus();
  };

  // Send message
  const sendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    if (serverPaused) return;
    const text = inputText.trim();
    if (!text || isStreaming || !selectedModel) return;

    setInputText("");
    setIsStreaming(true);

    // Add user message optimistically
    const userMsg: Message = {
      id: Date.now(),
      role: "user",
      content: text,
      encrypted: false,
      created_at: new Date().toISOString(),
    };
    addMessage(userMsg);

    // Build request body
    const body: api.PostChatStreamBody = {
      model: selectedModel,
      message: text,
      conversation_id: currentConversationId,
    };

    // Encrypt if key available
    const key = await getKey();
    if (key) {
      const { ciphertextB64, ivB64 } = await encryptMessage(key, text);
      body.message = ciphertextB64;
      body.iv = ivB64;
      body.encrypted = true;
    }

    try {
      const resp = await api.postChatStream(body);
      if (!resp.ok || !resp.body) {
        setIsStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let rafId: number | undefined;

      const scheduleUpdate = (t: string) => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          setStreamingText(t);
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;

          try {
            const data = JSON.parse(payload) as {
              conversation_id?: number;
              content?: string;
              encrypted?: boolean;
              iv?: string;
            };

            if (data.conversation_id && !currentConversationId) {
              setCurrentConversation(data.conversation_id);
            }

            if (data.content) {
              let chunk = data.content;
              if (data.encrypted && key && data.iv) {
                chunk = await decryptMessage(key, data.iv, chunk);
              }
              fullText += chunk;
              scheduleUpdate(fullText);
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      if (rafId) cancelAnimationFrame(rafId);

      // Finalize: add assistant message, clear streaming
      const assistantMsg: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: fullText,
        encrypted: false,
        created_at: new Date().toISOString(),
      };
      addMessage(assistantMsg);
      setStreamingText(null);
      loadConversations();
    } catch (err) {
      console.error("Stream error", err);
    } finally {
      setIsStreaming(false);
      textareaRef.current?.focus();
    }
  };

  // Textarea auto-resize and Enter to send
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInput = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 150) + "px";
    }
  };

  const userName = user.display_name || user.username;

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col w-72 bg-background border-r border-border shrink-0",
          "fixed inset-y-0 left-0 z-40 md:static md:z-auto",
          "transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border/50">
          <Logo className="w-5 h-5 text-foreground shrink-0" />
          <span className="font-semibold text-sm truncate">
            {serverInfo?.server_name || "Fireside"}
          </span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto md:hidden text-muted hover:text-foreground cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* New chat button */}
        <div className="px-4 py-4">
          <Button
            variant="secondary"
            size="md"
            className="w-full justify-start rounded-xl shadow-sm"
            onClick={startNewChat}
          >
            <Plus size={16} />
            New chat
          </Button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-4 space-y-1 mt-2">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                "group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer",
                currentConversationId === conv.id
                  ? "bg-surface text-foreground"
                  : "text-muted hover:text-foreground hover:bg-surface"
              )}
              onClick={() => openConversation(conv.id)}
            >
              <span className="truncate flex-1">{conv.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConv(conv.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-muted hover:text-danger transition-all cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Footer with User Dropdown */}
        <div className="p-4 border-t border-border/50 mt-auto">
          <UserDropdown />
        </div>
      </aside>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-muted hover:text-foreground cursor-pointer"
            >
              <Menu size={20} />
            </button>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-transparent border-none text-sm font-medium text-foreground outline-none cursor-pointer focus:ring-0"
            >
              {models.map((m) => (
                <option key={m.name} value={m.name} className="bg-background">
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <ThemeToggle />
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8">
          <div className="max-w-3xl mx-auto py-8">
            {messages.length === 0 && !streamingText && (
              <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center">
                <Logo className="w-12 h-12 mb-6 text-foreground/20" />
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  What can I help you with?
                </h2>
                <p className="text-sm text-muted max-w-md">
                  Ask me anything — get answers, brainstorm ideas, write content, debug code, or just have a conversation. Your messages are private and encrypted.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                userName={userName}
              />
            ))}

            {streamingText !== null && <StreamingBubble text={streamingText} />}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="px-4 md:px-8 py-4">
          {serverPaused ? (
            <div className="max-w-3xl mx-auto flex items-center gap-3 bg-amber/10 border border-amber/20 rounded-2xl px-5 py-4 text-amber">
              <PauseCircle size={20} className="shrink-0" />
              <div>
                <p className="text-sm font-medium">Server is currently paused</p>
                <p className="text-xs opacity-80 mt-0.5">The host has temporarily paused this server. Please try again later.</p>
              </div>
            </div>
          ) : (
            <form
              onSubmit={sendMessage}
              className="max-w-3xl mx-auto flex items-end gap-2 bg-surface border border-border rounded-2xl p-2 shadow-sm focus-within:ring-1 focus-within:ring-border transition-all"
            >
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                onInput={handleInput}
                placeholder="Ask anything..."
                rows={1}
                className="flex-1 bg-transparent border-none px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none resize-none"
                style={{ maxHeight: 200 }}
              />
              <Button
                type="submit"
                size="md"
                disabled={isStreaming || !inputText.trim()}
                className="shrink-0 rounded-xl h-10 w-10 mb-1"
              >
                {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </Button>
            </form>
          )}
          <div className="max-w-3xl mx-auto mt-3 text-center">
            <span className="text-xs font-medium text-muted">
              Private AI &middot; {serverInfo?.server_name || "Fireside"}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

// Type for postChatStream body that includes optional encryption fields
declare module "@/lib/api" {
  interface PostChatStreamBody {
    model: string;
    message: string;
    conversation_id?: number | null;
    encrypted?: boolean;
    iv?: string;
  }
}
