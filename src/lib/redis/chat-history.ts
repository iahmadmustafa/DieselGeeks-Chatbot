import { getRedis } from "@/lib/redis/client";

export const CHAT_HISTORY_TTL_SECONDS = 90 * 24 * 60 * 60;
export const CHAT_HISTORY_MAX_CONVERSATIONS = 50;
export const CHAT_HISTORY_MAX_MESSAGES = 100;

export interface StoredChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: unknown[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationRecord extends ConversationSummary {
  wpUserId: number;
  messages: StoredChatMessage[];
}

function indexKey(wpUserId: number): string {
  return `chat:user:${wpUserId}:index`;
}

function convKey(conversationId: string): string {
  return `chat:conv:${conversationId}`;
}

function isStoredMessage(value: unknown): value is StoredChatMessage {
  if (!value || typeof value !== "object") {
    return false;
  }
  const message = value as StoredChatMessage;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant" || message.role === "system") &&
    Array.isArray(message.parts)
  );
}

export function titleFromMessages(messages: StoredChatMessage[]): string {
  for (const message of messages) {
    if (message.role !== "user") {
      continue;
    }
    for (const part of message.parts) {
      if (
        part &&
        typeof part === "object" &&
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        const trimmed = part.text.trim().replace(/\s+/g, " ");
        if (trimmed) {
          return trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
        }
      }
    }
  }
  return "New chat";
}

function sanitizeMessages(messages: unknown[]): StoredChatMessage[] {
  return messages.filter(isStoredMessage).slice(-CHAT_HISTORY_MAX_MESSAGES);
}

export async function listConversations(wpUserId: number): Promise<ConversationSummary[]> {
  const redis = getRedis();
  const ids = (await redis.lrange<string>(indexKey(wpUserId), 0, CHAT_HISTORY_MAX_CONVERSATIONS - 1)) ?? [];
  if (ids.length === 0) {
    return [];
  }

  const summaries: ConversationSummary[] = [];
  for (const id of ids) {
    const record = await redis.get<ConversationRecord>(convKey(id));
    if (!record || record.wpUserId !== wpUserId) {
      continue;
    }
    summaries.push({
      id: record.id,
      title: record.title,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
  return summaries;
}

export async function getConversation(
  wpUserId: number,
  conversationId: string,
): Promise<ConversationRecord | null> {
  const redis = getRedis();
  const record = await redis.get<ConversationRecord>(convKey(conversationId));
  if (!record || record.wpUserId !== wpUserId) {
    return null;
  }
  return record;
}

/**
 * Creates or updates a conversation for a logged-in WP user. Keeps the user's
 * index ordered newest-first, enforces the per-user cap, and refreshes the
 * 90-day TTL on every write.
 */
export async function upsertConversation(options: {
  wpUserId: number;
  conversationId: string;
  messages: unknown[];
  title?: string;
}): Promise<ConversationRecord> {
  const redis = getRedis();
  const now = Date.now();
  const messages = sanitizeMessages(options.messages);
  const existing = await redis.get<ConversationRecord>(convKey(options.conversationId));

  if (existing && existing.wpUserId !== options.wpUserId) {
    throw new Error("Conversation belongs to another user");
  }

  const record: ConversationRecord = {
    id: options.conversationId,
    wpUserId: options.wpUserId,
    title: options.title?.trim() || titleFromMessages(messages),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    messages,
  };

  await redis.set(convKey(options.conversationId), record, { ex: CHAT_HISTORY_TTL_SECONDS });

  const index = indexKey(options.wpUserId);
  // Move to front of the list (newest activity first).
  await redis.lrem(index, 0, options.conversationId);
  await redis.lpush(index, options.conversationId);

  const overflow = await redis.lrange<string>(index, CHAT_HISTORY_MAX_CONVERSATIONS, -1);
  if (overflow && overflow.length > 0) {
    await redis.ltrim(index, 0, CHAT_HISTORY_MAX_CONVERSATIONS - 1);
    for (const oldId of overflow) {
      await redis.del(convKey(oldId));
    }
  }

  await redis.expire(index, CHAT_HISTORY_TTL_SECONDS);
  return record;
}

export async function deleteConversation(wpUserId: number, conversationId: string): Promise<boolean> {
  const redis = getRedis();
  const existing = await redis.get<ConversationRecord>(convKey(conversationId));
  if (!existing || existing.wpUserId !== wpUserId) {
    return false;
  }

  await redis.del(convKey(conversationId));
  await redis.lrem(indexKey(wpUserId), 0, conversationId);
  return true;
}
