import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { readEnvLocalValue } from "@/lib/env/load-env-local";

/**
 * Read a process.env value with common .env file issues stripped:
 * UTF-8 BOM, Windows CRLF trailing \r, surrounding quotes, outer whitespace.
 */
export function readEnv(name: string): string | null {
  const raw = process.env[name];
  if (raw == null || raw === "") {
    return null;
  }

  let value = raw.replace(/^\uFEFF/, "").trim();
  if (!value) {
    return null;
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  return value || null;
}

export function maskSecret(value: string): string {
  if (value.length <= 14) {
    return "***";
  }
  return `${value.slice(0, 10)}...${value.slice(-4)}`;
}

export type OpenAiKeySource = ".env.local" | "process.env" | "none";

export function getOpenAiApiKey(): string | null {
  // Next.js does not override process.env with .env.local when the variable
  // is already set at the OS level. Prefer .env.local for project keys.
  const fromEnvLocal = readEnvLocalValue("OPENAI_API_KEY");
  if (fromEnvLocal) {
    return fromEnvLocal;
  }

  return readEnv("OPENAI_API_KEY");
}

export function getOpenAiKeySource(): OpenAiKeySource {
  if (readEnvLocalValue("OPENAI_API_KEY")) {
    return ".env.local";
  }
  if (readEnv("OPENAI_API_KEY")) {
    return "process.env";
  }
  return "none";
}

/** Temporary debug helper — remove after API key issue is resolved. */
export function debugOpenAiKeyConfig(resolvedKey: string | null): void {
  const fromEnvLocal = readEnvLocalValue("OPENAI_API_KEY");
  const fromProcessEnv = readEnv("OPENAI_API_KEY");
  const rawProcessEnv = process.env.OPENAI_API_KEY;

  console.error("[fitment/openai-debug] key resolution", {
    source: getOpenAiKeySource(),
    uses_getOpenAiApiKey: true,
    uses_process_env_directly_in_normalize_path: false,
    resolved_key_length: resolvedKey?.length ?? 0,
    resolved_key_masked: resolvedKey ? maskSecret(resolvedKey) : null,
    env_local_key_length: fromEnvLocal?.length ?? 0,
    env_local_key_masked: fromEnvLocal ? maskSecret(fromEnvLocal) : null,
    process_env_trimmed_length: fromProcessEnv?.length ?? 0,
    process_env_trimmed_masked: fromProcessEnv ? maskSecret(fromProcessEnv) : null,
    process_env_raw_length: rawProcessEnv?.length ?? 0,
    process_env_raw_masked: rawProcessEnv ? maskSecret(rawProcessEnv) : null,
    env_local_differs_from_process_env: Boolean(
      fromEnvLocal && fromProcessEnv && fromEnvLocal !== fromProcessEnv,
    ),
    dot_env_exists: existsSync(resolve(process.cwd(), ".env")),
    dot_env_local_exists: existsSync(resolve(process.cwd(), ".env.local")),
    in_memory_key_cache: false,
  });

  console.error(
    "[fitment/openai-debug] note: no .env file in repo; only .env.local/.env.example. No module-level API key cache in fitment path.",
  );
}

export function getFitmentLlmModel(): string {
  return readEnvLocalValue("FITMENT_LLM_MODEL") ?? readEnv("FITMENT_LLM_MODEL") ?? "gpt-5-mini";
}

const FITMENT_REASONING_EFFORTS = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;

export type FitmentLlmReasoningEffort = (typeof FITMENT_REASONING_EFFORTS)[number];

export function getChatModel(): string {
  return readEnvLocalValue("CHAT_MODEL") ?? readEnv("CHAT_MODEL") ?? "gpt-5-mini";
}

export function getChatMaxOutputTokens(): number {
  const configured = Number(
    readEnvLocalValue("CHAT_MAX_OUTPUT_TOKENS") ?? readEnv("CHAT_MAX_OUTPUT_TOKENS") ?? "800",
  );
  if (Number.isNaN(configured) || configured < 100) {
    return 800;
  }
  return Math.min(configured, 4000);
}

export function getChatMaxMessageLength(): number {
  const configured = Number(
    readEnvLocalValue("CHAT_MAX_MESSAGE_LENGTH") ?? readEnv("CHAT_MAX_MESSAGE_LENGTH") ?? "500",
  );
  if (Number.isNaN(configured) || configured < 50) {
    return 500;
  }
  return Math.min(configured, 2000);
}

export function getChatMaxHistoryMessages(): number {
  const configured = Number(
    readEnvLocalValue("CHAT_MAX_HISTORY_MESSAGES") ?? readEnv("CHAT_MAX_HISTORY_MESSAGES") ?? "16",
  );
  if (Number.isNaN(configured) || configured < 2) {
    return 16;
  }
  return Math.min(configured, 40);
}

export function getContactUrl(): string {
  const configured = readEnvLocalValue("CONTACT_URL") ?? readEnv("CONTACT_URL");
  if (configured) {
    return configured;
  }

  const storeUrl = readEnv("WOOCOMMERCE_URL");
  if (storeUrl) {
    return `${storeUrl.replace(/\/$/, "")}/contact-us/`;
  }

  return "https://dieselgeeks.com.au/contact-us/";
}

function readPositiveNumber(
  envLocalName: string,
  envName: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const configured = Number(readEnvLocalValue(envLocalName) ?? readEnv(envName) ?? String(fallback));
  if (Number.isNaN(configured)) {
    return fallback;
  }
  return Math.min(Math.max(configured, min), max);
}

export function getChatRateLimitIpPerMinute(): number {
  return readPositiveNumber(
    "CHAT_RATE_LIMIT_IP_PER_MIN",
    "CHAT_RATE_LIMIT_IP_PER_MIN",
    12,
    1,
    60,
  );
}

export function getChatRateLimitSessionPerDay(): number {
  return readPositiveNumber(
    "CHAT_RATE_LIMIT_SESSION_PER_DAY",
    "CHAT_RATE_LIMIT_SESSION_PER_DAY",
    60,
    5,
    500,
  );
}

export function getChatDailyBudgetUsd(): number {
  return readPositiveNumber("CHAT_DAILY_BUDGET_USD", "CHAT_DAILY_BUDGET_USD", 5, 0.5, 500);
}

export function getChatEstimatedCostPerRequestUsd(): number {
  return readPositiveNumber(
    "CHAT_ESTIMATED_COST_PER_REQUEST_USD",
    "CHAT_ESTIMATED_COST_PER_REQUEST_USD",
    0.02,
    0.001,
    1,
  );
}

export interface TokenUsageLike {
  inputTokens?: number;
  outputTokens?: number;
}

export function estimateChatRequestCostUsd(usage?: TokenUsageLike): number {
  const fallback = getChatEstimatedCostPerRequestUsd();

  if (!usage) {
    return fallback;
  }

  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;

  if (inputTokens === 0 && outputTokens === 0) {
    return fallback;
  }

  // gpt-5-mini rough list pricing (USD per 1M tokens) — conservative estimate.
  const inputCost = inputTokens * (0.25 / 1_000_000);
  const outputCost = outputTokens * (2.0 / 1_000_000);
  const estimated = inputCost + outputCost;

  return Math.max(estimated, 0.001);
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const hostname = new URL(origin).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function getAllowedOrigins(): string[] {
  const configured = readEnvLocalValue("ALLOWED_ORIGINS") ?? readEnv("ALLOWED_ORIGINS");
  let origins: string[];

  if (configured) {
    origins = configured
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  } else {
    const storeUrl = readEnv("WOOCOMMERCE_URL");
    if (storeUrl) {
      try {
        origins = [new URL(storeUrl).origin];
      } catch {
        origins = [];
      }
    } else {
      origins = [];
    }
  }

  if (process.env.NODE_ENV === "development") {
    const localDevOrigins = [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
    ];
    return [...new Set([...origins, ...localDevOrigins])];
  }

  return origins.filter((origin) => !isLocalhostOrigin(origin));
}

export function getFitmentLlmReasoningEffort(): FitmentLlmReasoningEffort {
  const configured =
    readEnvLocalValue("FITMENT_LLM_REASONING_EFFORT") ??
    readEnv("FITMENT_LLM_REASONING_EFFORT") ??
    "low";

  if (FITMENT_REASONING_EFFORTS.includes(configured as FitmentLlmReasoningEffort)) {
    return configured as FitmentLlmReasoningEffort;
  }

  return "low";
}
