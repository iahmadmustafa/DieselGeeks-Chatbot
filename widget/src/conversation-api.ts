import { resolveApiBase } from "./config";
import type { ChatUIMessage } from "./types";

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ChatUIMessage[];
}

function authHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-DG-Identity-Token": token,
  };
}

export async function fetchConversations(token: string): Promise<ConversationSummary[]> {
  const response = await fetch(`${resolveApiBase()}/api/conversations`, {
    method: "GET",
    credentials: "omit",
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw new Error("Could not load conversations.");
  }

  const data = (await response.json()) as { conversations?: ConversationSummary[] };
  return Array.isArray(data.conversations) ? data.conversations : [];
}

export async function fetchConversation(token: string, id: string): Promise<ConversationDetail | null> {
  const response = await fetch(`${resolveApiBase()}/api/conversations/${encodeURIComponent(id)}`, {
    method: "GET",
    credentials: "omit",
    headers: authHeaders(token),
  });

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error("Could not load conversation.");
  }

  const data = (await response.json()) as { conversation?: ConversationDetail };
  return data.conversation ?? null;
}

export async function saveConversation(options: {
  token: string;
  conversationId: string;
  messages: ChatUIMessage[];
}): Promise<ConversationSummary> {
  const response = await fetch(`${resolveApiBase()}/api/conversations`, {
    method: "POST",
    credentials: "omit",
    headers: authHeaders(options.token),
    body: JSON.stringify({
      token: options.token,
      conversationId: options.conversationId,
      messages: options.messages,
    }),
  });

  if (!response.ok) {
    throw new Error("Could not save conversation.");
  }

  const data = (await response.json()) as { conversation: ConversationSummary };
  return data.conversation;
}

export async function deleteConversationApi(token: string, id: string): Promise<void> {
  const response = await fetch(`${resolveApiBase()}/api/conversations/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "omit",
    headers: authHeaders(token),
  });

  if (!response.ok && response.status !== 404) {
    throw new Error("Could not delete conversation.");
  }
}
