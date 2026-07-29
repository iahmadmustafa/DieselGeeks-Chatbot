import type { ChatUIMessage } from "./types";

const CONVERSATION_STORAGE_KEY = "dg_chat_conversation";

interface StoredConversation {
  sessionId: string;
  messages: ChatUIMessage[];
  savedAt: number;
}

function isValidStoredMessage(value: unknown): value is ChatUIMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as ChatUIMessage;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant" || message.role === "system") &&
    Array.isArray(message.parts)
  );
}

export function loadStoredConversation(sessionId: string): ChatUIMessage[] {
  try {
    const raw = localStorage.getItem(CONVERSATION_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as StoredConversation;
    if (parsed.sessionId !== sessionId || !Array.isArray(parsed.messages)) {
      return [];
    }

    return parsed.messages.filter(isValidStoredMessage);
  } catch {
    return [];
  }
}

export function saveStoredConversation(sessionId: string, messages: ChatUIMessage[]): void {
  try {
    if (messages.length === 0) {
      localStorage.removeItem(CONVERSATION_STORAGE_KEY);
      return;
    }

    const payload: StoredConversation = {
      sessionId,
      messages,
      savedAt: Date.now(),
    };

    localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota or private-mode storage failures.
  }
}
