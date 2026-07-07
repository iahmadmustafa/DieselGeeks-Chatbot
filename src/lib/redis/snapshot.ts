import { Redis } from "@upstash/redis";

import { readEnv } from "@/lib/env/read-env";
import type { FitmentParseResult, FitmentReviewItem, ProductSnapshot } from "@/types/catalog";

const SNAPSHOT_KEY = "catalog:snapshot:latest";
const SNAPSHOT_META_KEY = "catalog:snapshot:meta";
const FITMENT_PARSE_CACHE_PREFIX = "fitment:parse:";
const FITMENT_REVIEW_KEY = "fitment:review:list";

let redisClient: Redis | null = null;

function getRedis(): Redis {
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

export async function getSnapshot(): Promise<ProductSnapshot | null> {
  const redis = getRedis();
  return redis.get<ProductSnapshot>(SNAPSHOT_KEY);
}

export async function setSnapshot(snapshot: ProductSnapshot): Promise<void> {
  const redis = getRedis();

  await redis.set(SNAPSHOT_KEY, snapshot);
  await redis.set(SNAPSHOT_META_KEY, {
    version: snapshot.version,
    synced_at: snapshot.synced_at,
    product_count: snapshot.product_count,
  });
}

export async function getSnapshotMeta(): Promise<{
  version: string;
  synced_at: string;
  product_count: number;
} | null> {
  const redis = getRedis();
  return redis.get(SNAPSHOT_META_KEY);
}

export async function getFitmentParseCache(
  contentHash: string,
): Promise<FitmentParseResult | null> {
  const redis = getRedis();
  return redis.get<FitmentParseResult>(`${FITMENT_PARSE_CACHE_PREFIX}${contentHash}`);
}

export async function setFitmentParseCache(
  contentHash: string,
  result: FitmentParseResult,
): Promise<void> {
  const redis = getRedis();
  await redis.set(`${FITMENT_PARSE_CACHE_PREFIX}${contentHash}`, result);
}

export async function getFitmentReviewList(): Promise<FitmentReviewItem[]> {
  const redis = getRedis();
  return (await redis.get<FitmentReviewItem[]>(FITMENT_REVIEW_KEY)) ?? [];
}

export async function setFitmentReviewList(items: FitmentReviewItem[]): Promise<void> {
  const redis = getRedis();
  await redis.set(FITMENT_REVIEW_KEY, items);
}

export async function clearFitmentParseCache(): Promise<number> {
  const redis = getRedis();
  const keysToDelete: string[] = [];
  let cursor: string | number = 0;

  while (true) {
    const result: [string | number, string[]] = await redis.scan(cursor, {
      match: `${FITMENT_PARSE_CACHE_PREFIX}*`,
      count: 100,
    });

    cursor = result[0];
    keysToDelete.push(...result[1]);

    if (Number(cursor) === 0) {
      break;
    }
  }

  if (keysToDelete.length === 0) {
    return 0;
  }

  await redis.del(...keysToDelete);
  return keysToDelete.length;
}

