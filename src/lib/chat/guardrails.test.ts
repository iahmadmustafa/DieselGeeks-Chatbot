import { afterEach, describe, expect, it, vi } from "vitest";

import { rateLimitMessage } from "@/lib/chat/rate-limit";
import { getClientIp } from "@/lib/chat/request-meta";
import {
  estimateChatRequestCostUsd,
  getAllowedOrigins,
} from "@/lib/env/read-env";

describe("Phase 3 guardrails helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("extracts client IP from x-forwarded-for", () => {
    const request = new Request("https://example.com/api/chat", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 70.41.3.18",
      },
    });

    expect(getClientIp(request)).toBe("203.0.113.10");
  });

  it("returns friendly rate limit messages", () => {
    expect(rateLimitMessage("ip")).toMatch(/too quickly/i);
    expect(rateLimitMessage("session")).toMatch(/today's message limit/i);
  });

  it("estimates request cost from token usage", () => {
    const estimated = estimateChatRequestCostUsd({
      inputTokens: 1000,
      outputTokens: 500,
    });

    expect(estimated).toBeGreaterThan(0);
    expect(estimated).toBeLessThan(0.05);
  });

  it("strips localhost origins in production even if configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(
      "ALLOWED_ORIGINS",
      "https://dieselgeeks.com.au,https://stage2.dieselgeeks.com.au,http://localhost:3000",
    );

    expect(getAllowedOrigins().sort()).toEqual(
      ["https://dieselgeeks.com.au", "https://stage2.dieselgeeks.com.au"].sort(),
    );
  });

  it("keeps localhost origins in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOWED_ORIGINS", "https://stage2.dieselgeeks.com.au");

    const origins = getAllowedOrigins();
    expect(origins).toContain("https://stage2.dieselgeeks.com.au");
    expect(origins).toContain("http://localhost:3000");
  });
});
