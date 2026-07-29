/**
 * Minimal client for WooCommerce's Store API (`/wp-json/wc/store/v1`).
 *
 * This is the *read-only* slice used for in-chat cart review (stage 1 of the
 * in-chat checkout project). It intentionally only covers `GET /cart` — no
 * mutating calls yet. Mutating Store API calls (add/update/remove items,
 * addresses, checkout) require a `Nonce` header created server-side via
 * `wp_create_nonce('wc_store_api')`, or a `Cart-Token` obtained from this
 * same GET response's `Cart-Token` header; that comes in a later stage.
 *
 * The Store API lives on the WordPress/WooCommerce host itself (not our
 * Next.js `apiBase`), so all calls are relative to `window.location.origin`.
 */

const LOG_PREFIX = "[dieselgeeks-chat:store-api]";

export interface StoreApiCurrency {
  currency_code: string;
  currency_symbol: string;
  currency_minor_unit: number;
  currency_decimal_separator: string;
  currency_thousand_separator: string;
  currency_prefix: string;
  currency_suffix: string;
}

export interface StoreApiCartItemImage {
  id: number;
  src: string;
  thumbnail: string;
  name: string;
  alt: string;
}

export interface StoreApiCartItem {
  key: string;
  id: number;
  quantity: number;
  name: string;
  sku: string;
  permalink: string;
  images: StoreApiCartItemImage[];
  low_stock_remaining: number | null;
  backorders_allowed: boolean;
  prices: StoreApiCurrency & {
    price: string;
    regular_price: string;
    sale_price: string;
  };
  totals: StoreApiCurrency & {
    line_subtotal: string;
    line_subtotal_tax: string;
    line_total: string;
    line_total_tax: string;
  };
}

export interface StoreApiCartTotals extends StoreApiCurrency {
  total_items: string;
  total_items_tax: string;
  total_fees: string;
  total_fees_tax: string;
  total_discount: string;
  total_discount_tax: string;
  total_shipping: string | null;
  total_shipping_tax: string | null;
  total_price: string;
  total_tax: string;
}

export interface StoreApiCart {
  items: StoreApiCartItem[];
  items_count: number;
  items_weight: number;
  needs_shipping: boolean;
  needs_payment: boolean;
  has_calculated_shipping: boolean;
  totals: StoreApiCartTotals;
  errors: Array<{ code: string; message: string }>;
}

export type StoreApiCartResult = { ok: true; cart: StoreApiCart } | { ok: false; error: string };

function getStoreApiUrl(path: string): string {
  return `${window.location.origin}/wp-json/wc/store/v1${path}`;
}

/**
 * Fetches the current cart. Never throws — callers get a discriminated
 * result so loading/error UI state stays simple and can't get stuck, the
 * same defensive pattern used by `addProductToCart`.
 */
export async function getCart(): Promise<StoreApiCartResult> {
  let response: Response;
  try {
    response = await fetch(getStoreApiUrl("/cart"), {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
  } catch (networkError) {
    console.error(`${LOG_PREFIX} network error`, networkError);
    return { ok: false, error: "Could not load your cart. Check your connection and try again." };
  }

  try {
    if (!response.ok) {
      console.warn(`${LOG_PREFIX} unexpected status`, response.status);
      return { ok: false, error: "Could not load your cart right now." };
    }

    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !Array.isArray((data as StoreApiCart).items)) {
      console.warn(`${LOG_PREFIX} unexpected cart response shape`, data);
      return { ok: false, error: "Could not read your cart data." };
    }

    return { ok: true, cart: data as StoreApiCart };
  } catch (parseError) {
    console.error(`${LOG_PREFIX} failed to parse cart response`, parseError);
    return { ok: false, error: "Could not read your cart data." };
  }
}

/**
 * Formats a Store API money string (an integer string in the currency's
 * minor unit, e.g. cents) using the currency metadata the API returns
 * alongside it. Using the API's own currency fields (rather than hardcoding
 * a locale) keeps this correct if the store's currency/locale ever changes.
 */
export function formatStoreApiMoney(amountMinorUnits: string | null, currency: StoreApiCurrency): string {
  if (amountMinorUnits === null) {
    return "—";
  }

  const numeric = Number(amountMinorUnits);
  if (!Number.isFinite(numeric)) {
    return amountMinorUnits;
  }

  const minorUnit = currency.currency_minor_unit ?? 2;
  const divisor = 10 ** minorUnit;
  const value = numeric / divisor;
  const [wholePart, fractionPart = ""] = value.toFixed(minorUnit).split(".");
  const thousandSeparator = currency.currency_thousand_separator || ",";
  const withThousands = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator);
  const fraction = minorUnit > 0 ? `${currency.currency_decimal_separator}${fractionPart}` : "";

  return `${currency.currency_prefix}${withThousands}${fraction}${currency.currency_suffix}`;
}
