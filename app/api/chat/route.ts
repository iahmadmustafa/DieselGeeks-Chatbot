import { randomUUID } from "node:crypto";

import { assistantUnavailableMessage, isDailyBudgetExceeded } from "@/lib/chat/budget";
import { buildCorsHeaders, isOriginAllowed } from "@/lib/chat/cors";
import {
  isValidSessionId,
  validateChatMessages,
} from "@/lib/chat/guardrails";
import { checkChatRateLimits, rateLimitMessage } from "@/lib/chat/rate-limit";
import { getClientIp } from "@/lib/chat/request-meta";
import { createChatResponse } from "@/lib/chat/run-chat";
import type { ChatUIMessage } from "@/types/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ChatRequestBody {
  messages?: Array<Omit<ChatUIMessage, "id"> & { id?: string }>;
  sessionId?: string;
}

function normalizeMessages(
  messages: Array<Omit<ChatUIMessage, "id"> & { id?: string }>,
): ChatUIMessage[] {
  return messages.map((message, index) => ({
    ...message,
    id: message.id ?? `msg-${index}`,
  }));
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  request: Request,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...buildCorsHeaders(request),
    },
  });
}

function jsonError(message: string, status: number, request: Request): Response {
  return jsonResponse({ error: message }, status, request);
}

export async function OPTIONS(request: Request): Promise<Response> {
  const corsHeaders = buildCorsHeaders(request);
  if (Object.keys(corsHeaders).length === 0 && request.headers.get("Origin")) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("Origin");

  if (!isOriginAllowed(request)) {
    console.warn("[guardrails] origin blocked", { origin });
    return jsonError("Origin not allowed", 403, request);
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return jsonError("Invalid JSON body", 400, request);
  }

  const messages = normalizeMessages(body.messages ?? []);
  const validationError = validateChatMessages(messages);
  if (validationError) {
    console.warn("[guardrails] message validation failed", { reason: validationError });
    return jsonError(validationError, 400, request);
  }

  const sessionId =
    body.sessionId && isValidSessionId(body.sessionId)
      ? body.sessionId
      : randomUUID().replace(/-/g, "").slice(0, 32);

  const clientIp = getClientIp(request);

  try {
    const rateLimitHit = await checkChatRateLimits({ ip: clientIp, sessionId });
    if (rateLimitHit) {
      console.warn("[guardrails] rate limit exceeded", {
        kind: rateLimitHit.kind,
        ip: clientIp,
        sessionId,
        limit: rateLimitHit.limit,
        remaining: rateLimitHit.remaining,
        reset: rateLimitHit.reset,
      });
      return jsonResponse(
        {
          error: rateLimitMessage(rateLimitHit.kind),
          code: rateLimitHit.kind === "ip" ? "rate_limited" : "session_daily_limit",
        },
        429,
        request,
      );
    }

    const budgetStatus = await isDailyBudgetExceeded();
    if (budgetStatus.exceeded) {
      console.warn("[guardrails] daily budget exceeded", {
        spentUsd: budgetStatus.spentUsd,
        limitUsd: budgetStatus.limitUsd,
        dateKey: budgetStatus.dateKey,
        sessionId,
        ip: clientIp,
      });
      return jsonResponse(
        {
          error: assistantUnavailableMessage(),
          code: "assistant_unavailable",
        },
        503,
        request,
      );
    }
  } catch (error) {
    console.error("[guardrails] preflight check failed — allowing request", {
      sessionId,
      ip: clientIp,
      error,
    });
  }

  try {
    return await createChatResponse({
      messages,
      sessionId,
      headers: buildCorsHeaders(request),
    });
  } catch (error) {
    console.error("[api/chat] request failed", error);
    const message = error instanceof Error ? error.message : "Chat request failed";
    const status = message.includes("Catalog snapshot") ? 503 : 500;
    return jsonError(message, status, request);
  }
}
