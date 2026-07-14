import { Redis } from "@upstash/redis";

import { readEnv } from "@/lib/env/read-env";

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (!redisClient) {
    const url = readEnv("UPSTASH_REDIS_REST_URL");
    const token = readEnv("UPSTASH_REDIS_REST_TOKEN");

    if (!url || !token) {
      throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required");
    }

    redisClient = new Redis({ url, token });
  }

  return redisClient;
}
