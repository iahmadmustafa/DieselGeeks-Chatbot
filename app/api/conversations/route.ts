import { getWpIdentityFromRequest } from "@/lib/auth/request-identity";
import { buildCorsHeaders, isOriginAllowed } from "@/lib/chat/cors";
import { listConversations, upsertConversation } from "@/lib/redis/chat-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(body: Record<string, unknown>, status: number, request: Request): Response {
  return new Response(JSON.stringify(body), {
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
  return new Response(null, { status: 204, headers: corsHeaders });
}

/** Lists the logged-in user's saved conversations (newest first). */
export async function GET(request: Request): Promise<Response> {
  if (!isOriginAllowed(request)) {
    return jsonResponse({ error: "Origin not allowed" }, 403, request);
  }

  const identity = getWpIdentityFromRequest(request);
  if (!identity) {
    return jsonResponse({ error: "Sign in required" }, 401, request);
  }

  try {
    const conversations = await listConversations(identity.wpUserId);
    return jsonResponse({ conversations }, 200, request);
  } catch (error) {
    console.error("[api/conversations] list failed", error);
    return jsonResponse({ error: "Could not load conversations." }, 500, request);
  }
}

interface UpsertBody {
  token?: string;
  conversationId?: string;
  messages?: unknown[];
  title?: string;
}

/** Creates or updates a conversation for the logged-in user. */
export async function POST(request: Request): Promise<Response> {
  if (!isOriginAllowed(request)) {
    return jsonResponse({ error: "Origin not allowed" }, 403, request);
  }

  let body: UpsertBody;
  try {
    body = (await request.json()) as UpsertBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, request);
  }

  const identity = getWpIdentityFromRequest(request, body.token);
  if (!identity) {
    return jsonResponse({ error: "Sign in required" }, 401, request);
  }

  const conversationId = typeof body.conversationId === "string" ? body.conversationId.trim() : "";
  if (!conversationId || conversationId.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(conversationId)) {
    return jsonResponse({ error: "Invalid conversation id." }, 400, request);
  }

  if (!Array.isArray(body.messages)) {
    return jsonResponse({ error: "messages must be an array." }, 400, request);
  }

  try {
    const conversation = await upsertConversation({
      wpUserId: identity.wpUserId,
      conversationId,
      messages: body.messages,
      title: typeof body.title === "string" ? body.title.slice(0, 80) : undefined,
    });

    return jsonResponse(
      {
        conversation: {
          id: conversation.id,
          title: conversation.title,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        },
      },
      200,
      request,
    );
  } catch (error) {
    console.error("[api/conversations] upsert failed", error);
    return jsonResponse({ error: "Could not save conversation." }, 500, request);
  }
}
