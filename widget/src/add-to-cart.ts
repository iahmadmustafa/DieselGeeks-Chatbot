export interface AddToCartResult {
  ok: boolean;
  error?: string;
}

export const CART_ADDED_EVENT = "dieselgeeks:cart-added";

export interface CartAddedDetail {
  productId: number;
  productTitle: string;
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

export async function addProductToCart(productId: number): Promise<AddToCartResult> {
  const body = new URLSearchParams();
  body.set("product_id", String(productId));
  body.set("quantity", "1");

  try {
    const response = await fetch(getWooCommerceAjaxUrl("add_to_cart"), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: body.toString(),
      credentials: "same-origin",
    });

    if (!response.ok) {
      return { ok: false, error: "Could not add item to cart." };
    }

    const data = (await response.json()) as {
      error?: boolean | string;
      fragments?: Record<string, string>;
      cart_hash?: string;
    };

    if (data.error) {
      return {
        ok: false,
        error: typeof data.error === "string" ? data.error : "Could not add item to cart.",
      };
    }

    refreshWooCommerceCartFragments(data.fragments, data.cart_hash);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not add item to cart." };
  }
}

export function notifyCartAdded(detail: CartAddedDetail): void {
  window.dispatchEvent(new CustomEvent(CART_ADDED_EVENT, { detail }));
}
