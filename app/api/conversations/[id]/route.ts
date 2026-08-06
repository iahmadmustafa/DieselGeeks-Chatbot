import { getWpIdentityFromRequest } from "@/lib/auth/request-identity";
import { buildCorsHeaders, isOriginAllowed } from "@/lib/chat/cors";
import { deleteConversation, getConversation } from "@/lib/redis/chat-history";

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

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  if (!isOriginAllowed(request)) {
    return jsonResponse({ error: "Origin not allowed" }, 403, request);
  }

  const identity = getWpIdentityFromRequest(request);
  if (!identity) {
    return jsonResponse({ error: "Sign in required" }, 401, request);
  }

  const { id } = await context.params;
  if (!id) {
    return jsonResponse({ error: "Missing conversation id." }, 400, request);
  }

  try {
    const conversation = await getConversation(identity.wpUserId, id);
    if (!conversation) {
      return jsonResponse({ error: "Conversation not found." }, 404, request);
    }
    return jsonResponse({ conversation }, 200, request);
  } catch (error) {
    console.error("[api/conversations/[id]] get failed", error);
    return jsonResponse({ error: "Could not load conversation." }, 500, request);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  if (!isOriginAllowed(request)) {
    return jsonResponse({ error: "Origin not allowed" }, 403, request);
  }

  const identity = getWpIdentityFromRequest(request);
  if (!identity) {
    return jsonResponse({ error: "Sign in required" }, 401, request);
  }

  const { id } = await context.params;
  if (!id) {
    return jsonResponse({ error: "Missing conversation id." }, 400, request);
  }

  try {
    const deleted = await deleteConversation(identity.wpUserId, id);
    if (!deleted) {
      return jsonResponse({ error: "Conversation not found." }, 404, request);
    }
    return jsonResponse({ ok: true }, 200, request);
  } catch (error) {
    console.error("[api/conversations/[id]] delete failed", error);
    return jsonResponse({ error: "Could not delete conversation." }, 500, request);
  }
}
