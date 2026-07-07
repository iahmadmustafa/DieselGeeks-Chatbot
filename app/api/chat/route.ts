import { randomUUID } from "node:crypto";

import { buildCorsHeaders, isOriginAllowed } from "@/lib/chat/cors";
import {
  isValidSessionId,
  validateChatMessages,
} from "@/lib/chat/guardrails";
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

function jsonError(message: string, status: number, request: Request): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...buildCorsHeaders(request),
    },
  });
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
  if (!isOriginAllowed(request)) {
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
    return jsonError(validationError, 400, request);
  }

  const sessionId =
    body.sessionId && isValidSessionId(body.sessionId)
      ? body.sessionId
      : randomUUID().replace(/-/g, "").slice(0, 32);

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
