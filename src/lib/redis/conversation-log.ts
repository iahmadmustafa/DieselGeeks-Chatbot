import { getRedis } from "@/lib/redis/client";
import type { ConversationLogEntry } from "@/types/chat";

const LOG_KEY_PREFIX = "conversation:log:";
const LOG_TTL_SECONDS = 90 * 24 * 60 * 60;
const MAX_ENTRIES_PER_SESSION = 100;

export async function appendConversationLog(entry: ConversationLogEntry): Promise<void> {
  try {
    const redis = getRedis();
    const key = `${LOG_KEY_PREFIX}${entry.session_id}`;

    await redis.lpush(key, entry);
    await redis.ltrim(key, 0, MAX_ENTRIES_PER_SESSION - 1);
    await redis.expire(key, LOG_TTL_SECONDS);
  } catch (error) {
    console.error("[conversation-log] append failed", error);
    throw error;
  }
}

export async function getConversationLog(sessionId: string): Promise<ConversationLogEntry[]> {
  const redis = getRedis();
  const key = `${LOG_KEY_PREFIX}${sessionId}`;
  return (await redis.lrange<ConversationLogEntry>(key, 0, MAX_ENTRIES_PER_SESSION - 1)) ?? [];
}
