import { Ratelimit } from "@upstash/ratelimit";

import {
  getChatRateLimitIpPerMinute,
  getChatRateLimitSessionPerDay,
} from "@/lib/env/read-env";
import { getRedis } from "@/lib/redis/client";

export type RateLimitKind = "ip" | "session";

export interface RateLimitResult {
  allowed: boolean;
  kind: RateLimitKind;
  limit: number;
  remaining: number;
  reset: number;
}

let ipRateLimiter: Ratelimit | null = null;
let sessionRateLimiter: Ratelimit | null = null;

function getIpRateLimiter(): Ratelimit {
  if (!ipRateLimiter) {
    ipRateLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(getChatRateLimitIpPerMinute(), "1 m"),
      prefix: "ratelimit:chat:ip",
      analytics: true,
    });
  }

  return ipRateLimiter;
}

function getSessionRateLimiter(): Ratelimit {
  if (!sessionRateLimiter) {
    sessionRateLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(getChatRateLimitSessionPerDay(), "1 d"),
      prefix: "ratelimit:chat:session",
      analytics: true,
    });
  }

  return sessionRateLimiter;
}

export function rateLimitMessage(kind: RateLimitKind): string {
  if (kind === "ip") {
    return "You're sending messages a bit too quickly. Please wait a moment and try again.";
  }

  return "You've reached today's message limit for this chat session. Please contact us if you need more help.";
}

export async function checkChatRateLimits(options: {
  ip: string;
  sessionId: string;
}): Promise<RateLimitResult | null> {
  const ipResult = await getIpRateLimiter().limit(options.ip);
  if (!ipResult.success) {
    return {
      allowed: false,
      kind: "ip",
      limit: ipResult.limit,
      remaining: ipResult.remaining,
      reset: ipResult.reset,
    };
  }

  const sessionResult = await getSessionRateLimiter().limit(options.sessionId);
  if (!sessionResult.success) {
    return {
      allowed: false,
      kind: "session",
      limit: sessionResult.limit,
      remaining: sessionResult.remaining,
      reset: sessionResult.reset,
    };
  }

  return null;
}
