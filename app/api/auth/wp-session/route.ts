import { buildCorsHeaders, isOriginAllowed } from "@/lib/chat/cors";
import { verifyWpIdentityToken } from "@/lib/auth/wp-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface WpSessionBody {
  token?: string;
}

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

/**
 * Exchanges a WordPress-issued identity token (see
 * wordpress/dieselgeeks-chat-identity.php) for a confirmation the widget can
 * use to render "signed in as ..." UI. This is deliberately the only place
 * that needs to know how the token is verified — /api/chat and any future
 * history endpoints just call verifyWpIdentityToken directly with the same
 * token, this route exists purely so the widget has something to call right
 * after page load to know whether to show a name or a sign-in prompt.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isOriginAllowed(request)) {
    return jsonResponse({ error: "Origin not allowed" }, 403, request);
  }

  let body: WpSessionBody;
  try {
    body = (await request.json()) as WpSessionBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, request);
  }

  const identity = verifyWpIdentityToken(body.token);
  if (!identity) {
    return jsonResponse({ loggedIn: false }, 200, request);
  }

  return jsonResponse({ loggedIn: true, displayName: identity.displayName }, 200, request);
}
