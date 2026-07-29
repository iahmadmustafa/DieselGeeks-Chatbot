export interface AddToCartResult {
  ok: boolean;
  error?: string;
}

export const CART_ADDED_EVENT = "dieselgeeks:cart-added";

export interface CartAddedDetail {
  productId: number;
  productTitle: string;
}

const LOG_PREFIX = "[dieselgeeks-chat:add-to-cart]";

interface WooAddToCartPayload {
  error?: unknown;
  fragments?: Record<string, string>;
  cart_hash?: string;
}

function getWooCommerceAjaxUrl(endpoint: string): string {
  const params = window.wc_add_to_cart_params;
  if (params?.wc_ajax_url) {
    return params.wc_ajax_url.toString().replace("%%endpoint%%", endpoint);
  }

  return `${window.location.origin}/?wc-ajax=${endpoint}`;
}

function refreshWooCommerceCartFragments(
  fragments?: Record<string, string>,
  cartHash?: string,
): void {
  const jq = window.jQuery;
  if (!jq || !fragments) {
    return;
  }

  jq.each(fragments, (selector, html) => {
    jq(selector).replaceWith(html);
  });

  (jq as (target: HTMLElement) => { trigger: (event: string, args?: unknown[]) => void })(
    document.body,
  ).trigger("added_to_cart", [fragments, cartHash]);
}

/**
 * WooCommerce's error field is only meaningful when it is `true` or a
 * non-empty message string. Some sites/plugins send `error: false` or omit
 * the field entirely on success — treating any truthy-looking key as failure
 * was the bug; this only fails on an *explicit* error signal.
 */
function hasExplicitError(error: unknown): error is true | string {
  if (error === true) {
    return true;
  }
  return typeof error === "string" && error.trim().length > 0;
}

/**
 * Parse the raw AJAX body into a JSON object. Some WooCommerce sites emit
 * PHP notices/warnings before the JSON payload (visible only in the raw
 * response text), which makes `response.json()` throw even though the
 * add-to-cart call itself succeeded server-side. Salvage the JSON substring
 * when a direct parse fails instead of assuming failure.
 */
function extractJsonPayload(rawText: string): WooAddToCartPayload | null {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return null;
  }

  const tryParse = (candidate: string): WooAddToCartPayload | null => {
    try {
      const parsed: unknown = JSON.parse(candidate);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as WooAddToCartPayload)
        : null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(trimmed);
  if (direct) {
    return direct;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return tryParse(trimmed.slice(firstBrace, lastBrace + 1));
}

export async function addProductToCart(productId: number): Promise<AddToCartResult> {
  const body = new URLSearchParams();
  body.set("product_id", String(productId));
  body.set("quantity", "1");

  let response: Response;
  try {
    response = await fetch(getWooCommerceAjaxUrl("add_to_cart"), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: body.toString(),
      credentials: "same-origin",
    });
  } catch (networkError) {
    console.error(`${LOG_PREFIX} network error`, networkError);
    return { ok: false, error: "Could not add item to cart." };
  }

  const rawText = await response.text();

  // eslint-disable-next-line no-console -- intentional debugging aid for diagnosing site-specific response shapes
  console.log(`${LOG_PREFIX} raw response`, {
    status: response.status,
    ok: response.ok,
    body: rawText,
  });

  const data = extractJsonPayload(rawText);

  if (data && hasExplicitError(data.error)) {
    console.warn(`${LOG_PREFIX} WooCommerce reported an error`, data.error);
    return {
      ok: false,
      error: typeof data.error === "string" && data.error.trim() ? data.error : "Could not add item to cart.",
    };
  }

  if (data) {
    refreshWooCommerceCartFragments(data.fragments, data.cart_hash);
    return { ok: true };
  }

  if (response.ok) {
    console.warn(
      `${LOG_PREFIX} response body was not valid JSON, but HTTP status was OK — treating as success`,
    );
    return { ok: true };
  }

  console.warn(`${LOG_PREFIX} response body was not valid JSON and HTTP status was not OK`);
  return { ok: false, error: "Could not add item to cart." };
}

export function notifyCartAdded(detail: CartAddedDetail): void {
  window.dispatchEvent(new CustomEvent(CART_ADDED_EVENT, { detail }));
}
