import { create } from "zustand";
import type { Conversation, Message } from "@/lib/types";

interface ChatState {
  conversations: Conversation[];
  currentConversationId: number | null;
  messages: Message[];
  streamingText: string | null;
  isStreaming: boolean;

  setConversations: (convos: Conversation[]) => void;
  setCurrentConversation: (id: number | null) => void;
  setMessages: (msgs: Message[]) => void;
  addMessage: (msg: Message) => void;
  setStreamingText: (text: string | null) => void;
  setIsStreaming: (streaming: boolean) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  streamingText: null,
  isStreaming: false,

  setConversations: (conversations) => set({ conversations }),
  setCurrentConversation: (id) => set({ currentConversationId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),
  setStreamingText: (text) => set({ streamingText: text }),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  reset: () =>
    set({
      currentConversationId: null,
      messages: [],
      streamingText: null,
      isStreaming: false,
    }),
}));
