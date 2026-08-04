import { buildCorsHeaders, isOriginAllowed } from "@/lib/chat/cors";
import { checkRestockNotifyRateLimit } from "@/lib/chat/rate-limit";
import { getClientIp } from "@/lib/chat/request-meta";
import { getResendApiKey, getResendFromEmail, getRestockNotifyEmail } from "@/lib/env/read-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAME_MAX = 120;
const EMAIL_MAX = 200;
const MESSAGE_MAX = 1000;
const PRODUCT_TITLE_MAX = 300;

interface NotifyRestockBody {
  name?: string;
  email?: string;
  message?: string;
  product?: {
    id?: number;
    title?: string;
    sku?: string;
    permalink?: string;
  };
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function OPTIONS(request: Request): Promise<Response> {
  const corsHeaders = buildCorsHeaders(request);
  if (Object.keys(corsHeaders).length === 0 && request.headers.get("Origin")) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request): Promise<Response> {
  if (!isOriginAllowed(request)) {
    return jsonResponse({ error: "Origin not allowed" }, 403, request);
  }

  let body: NotifyRestockBody;
  try {
    body = (await request.json()) as NotifyRestockBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, request);
  }

  const name = body.name?.trim().slice(0, NAME_MAX) ?? "";
  const email = body.email?.trim().slice(0, EMAIL_MAX) ?? "";
  const message = body.message?.trim().slice(0, MESSAGE_MAX) ?? "";
  const productTitle = body.product?.title?.trim().slice(0, PRODUCT_TITLE_MAX) ?? "";
  const productId = typeof body.product?.id === "number" ? body.product.id : null;
  const productSku = body.product?.sku?.trim().slice(0, 100) ?? "";
  const productPermalink = body.product?.permalink?.trim().slice(0, 500) ?? "";

  if (!name) {
    return jsonResponse({ error: "Please enter your name." }, 400, request);
  }
  if (!email || !EMAIL_PATTERN.test(email)) {
    return jsonResponse({ error: "Please enter a valid email address." }, 400, request);
  }
  if (!productTitle) {
    return jsonResponse({ error: "Missing product information." }, 400, request);
  }

  try {
    const ip = getClientIp(request);
    const allowed = await checkRestockNotifyRateLimit(ip);
    if (!allowed) {
      return jsonResponse(
        { error: "Too many requests. Please try again in a little while." },
        429,
        request,
      );
    }
  } catch (error) {
    console.error("[api/notify-restock] rate limit check failed — allowing request", error);
  }

  const resendApiKey = getResendApiKey();
  if (!resendApiKey) {
    console.error("[api/notify-restock] RESEND_API_KEY is not configured — cannot send email");
    return jsonResponse(
      { error: "This feature isn't fully set up yet. Please try again later." },
      503,
      request,
    );
  }

  const notifyEmail = getRestockNotifyEmail();
  const fromEmail = getResendFromEmail();

  const subject = `Restock request: ${productTitle}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #1a1a1a;">
      <h2 style="margin: 0 0 12px;">New restock notification request</h2>
      <p style="margin: 0 0 4px;"><strong>Product:</strong> ${escapeHtml(productTitle)}</p>
      ${productSku ? `<p style="margin: 0 0 4px;"><strong>SKU:</strong> ${escapeHtml(productSku)}</p>` : ""}
      ${productId !== null ? `<p style="margin: 0 0 4px;"><strong>Product ID:</strong> ${productId}</p>` : ""}
      ${
        productPermalink
          ? `<p style="margin: 0 0 4px;"><strong>Link:</strong> <a href="${escapeHtml(productPermalink)}">${escapeHtml(productPermalink)}</a></p>`
          : ""
      }
      <hr style="margin: 16px 0; border: none; border-top: 1px solid #e5e5e5;" />
      <p style="margin: 0 0 4px;"><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p style="margin: 0 0 4px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
      ${message ? `<p style="margin: 12px 0 0;"><strong>Message:</strong><br />${escapeHtml(message).replace(/\n/g, "<br />")}</p>` : ""}
    </div>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [notifyEmail],
        reply_to: email,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[api/notify-restock] Resend request failed", {
        status: response.status,
        body: errorBody,
      });
      return jsonResponse(
        { error: "Could not send your request. Please try again later." },
        502,
        request,
      );
    }
  } catch (error) {
    console.error("[api/notify-restock] Resend request errored", error);
    return jsonResponse({ error: "Could not send your request. Please try again later." }, 502, request);
  }

  return jsonResponse({ ok: true }, 200, request);
}
