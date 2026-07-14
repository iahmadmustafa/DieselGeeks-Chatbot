import {
  estimateChatRequestCostUsd,
  getChatDailyBudgetUsd,
  getContactUrl,
} from "@/lib/env/read-env";
import { getRedis } from "@/lib/redis/client";

const BUDGET_KEY_PREFIX = "chat:budget:spend:";
const BUDGET_TTL_SECONDS = 48 * 60 * 60;

export interface DailyBudgetStatus {
  exceeded: boolean;
  spentUsd: number;
  limitUsd: number;
  dateKey: string;
}

export interface TokenUsageLike {
  inputTokens?: number;
  outputTokens?: number;
}

function getUtcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function getBudgetRedisKey(date = new Date()): string {
  return `${BUDGET_KEY_PREFIX}${getUtcDateKey(date)}`;
}

export function assistantUnavailableMessage(): string {
  const contactUrl = getContactUrl();
  return `Our parts assistant is temporarily unavailable. Please contact us and we'll help you directly: ${contactUrl}`;
}

export async function getDailyBudgetStatus(date = new Date()): Promise<DailyBudgetStatus> {
  const redis = getRedis();
  const dateKey = getUtcDateKey(date);
  const key = getBudgetRedisKey(date);
  const spentRaw = await redis.get<number | string>(key);
  const spentUsd = Number(spentRaw ?? 0);
  const limitUsd = getChatDailyBudgetUsd();

  return {
    exceeded: spentUsd >= limitUsd,
    spentUsd,
    limitUsd,
    dateKey,
  };
}

export async function isDailyBudgetExceeded(date = new Date()): Promise<DailyBudgetStatus> {
  return getDailyBudgetStatus(date);
}

export async function recordChatSpend(
  usage?: TokenUsageLike,
  date = new Date(),
): Promise<DailyBudgetStatus> {
  const redis = getRedis();
  const key = getBudgetRedisKey(date);
  const increment = estimateChatRequestCostUsd(usage);

  await redis.incrbyfloat(key, increment);
  await redis.expire(key, BUDGET_TTL_SECONDS);

  return getDailyBudgetStatus(date);
}
