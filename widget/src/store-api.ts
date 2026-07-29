/**
 * Client for WooCommerce's Store API (`/wp-json/wc/store/v1`).
 *
 * Covers stage 1 (read-only cart) and stage 2 (address + shipping) of the
 * in-chat checkout project. Mutating calls (`update-customer`,
 * `select-shipping-rate`) require either a `Nonce` header created
 * server-side via `wp_create_nonce('wc_store_api')`, or a `Cart-Token`
 * returned in the response headers of any prior Store API call — we use the
 * latter, since it needs no WordPress-side changes and is what WooCommerce's
 * own docs recommend for headless/JS clients:
 * https://developer.woocommerce.com/docs/apis/store-api/nonce-tokens/
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

export interface StoreApiAddress {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface StoreApiShippingRate {
  rate_id: string;
  name: string;
  description: string;
  delivery_time: string;
  price: string;
  taxes: string;
  instance_id: number;
  method_id: string;
  selected: boolean;
  currency_code: string;
  currency_symbol: string;
  currency_minor_unit: number;
  currency_decimal_separator: string;
  currency_thousand_separator: string;
  currency_prefix: string;
  currency_suffix: string;
}

export interface StoreApiShippingPackage {
  package_id: number | string;
  name: string;
  shipping_rates: StoreApiShippingRate[];
}

export interface StoreApiCart {
  items: StoreApiCartItem[];
  items_count: number;
  items_weight: number;
  needs_shipping: boolean;
  needs_payment: boolean;
  has_calculated_shipping: boolean;
  shipping_address: StoreApiAddress;
  billing_address: StoreApiAddress;
  shipping_rates: StoreApiShippingPackage[];
  totals: StoreApiCartTotals;
  errors: Array<{ code: string; message: string }>;
}

export type StoreApiCartResult = { ok: true; cart: StoreApiCart } | { ok: false; error: string };

function getStoreApiUrl(path: string): string {
  // A cache-busting query param defeats CDN/edge/object-cache layers that key
  // purely on URL and ignore the fetch-level `cache: "no-store"` hint below
  // (that hint only affects the browser's own HTTP cache, not intermediate
  // proxies). Without this, the cart view can keep showing an earlier,
  // smaller snapshot of the cart after items are added.
  const cacheBuster = `_dgts=${Date.now()}`;
  const separator = path.includes("?") ? "&" : "?";
  return `${window.location.origin}/wp-json/wc/store/v1${path}${separator}${cacheBuster}`;
}

/**
 * WooCommerce issues a fresh `Cart-Token` on every Store API response. We
 * cache the latest one in memory and send it back on every subsequent
 * mutating call — this is what authorizes writes (add/update/remove,
 * addresses, shipping) instead of the `Nonce` header, and needs no
 * WordPress-side code changes.
 */
let cachedCartToken: string | null = null;

function captureCartToken(response: Response): void {
  const token = response.headers.get("Cart-Token");
  if (token) {
    cachedCartToken = token;
  }
}

interface StoreApiRequestSuccess<T> {
  ok: true;
  data: T;
}

interface StoreApiRequestFailure {
  ok: false;
  error: string;
}

type StoreApiRequestResult<T> = StoreApiRequestSuccess<T> | StoreApiRequestFailure;

function extractErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return `Request failed (${status}).`;
}

/**
 * Shared request plumbing for every Store API call. Never throws — every
 * caller gets a discriminated result, the same defensive pattern used by
 * `addProductToCart`, so loading/error UI state can't get stuck.
 */
async function storeApiRequest<T>(path: string, init: RequestInit): Promise<StoreApiRequestResult<T>> {
  let response: Response;
  try {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (cachedCartToken) {
      headers.set("Cart-Token", cachedCartToken);
    }

    response = await fetch(getStoreApiUrl(path), {
      ...init,
      headers,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (networkError) {
    console.error(`${LOG_PREFIX} network error`, networkError);
    return { ok: false, error: "Could not connect. Check your connection and try again." };
  }

  captureCartToken(response);

  let data: unknown = null;
  try {
    data = await response.json();
  } catch (parseError) {
    if (response.ok) {
      console.error(`${LOG_PREFIX} failed to parse response`, parseError);
      return { ok: false, error: "Could not read the response." };
    }
  }

  if (!response.ok) {
    console.warn(`${LOG_PREFIX} request failed`, { path, status: response.status, data });
    return { ok: false, error: extractErrorMessage(data, response.status) };
  }

  return { ok: true, data: data as T };
}

function toCartResult(result: StoreApiRequestResult<StoreApiCart>): StoreApiCartResult {
  if (!result.ok) {
    return result;
  }

  if (!result.data || !Array.isArray(result.data.items)) {
    console.warn(`${LOG_PREFIX} unexpected cart response shape`, result.data);
    return { ok: false, error: "Could not read your cart data." };
  }

  return { ok: true, cart: result.data };
}

/** Fetches the current cart. This is the only call that needs no Cart-Token. */
export async function getCart(): Promise<StoreApiCartResult> {
  const result = await storeApiRequest<StoreApiCart>("/cart", { method: "GET" });
  return toCartResult(result);
}

/**
 * Updates the cart's shipping (and optionally billing) address, which
 * triggers WooCommerce to recalculate shipping rates and tax. Only send the
 * fields you have — omitted fields keep their existing server-side value.
 */
export async function updateCustomerAddress(address: {
  shipping_address?: Partial<StoreApiAddress>;
  billing_address?: Partial<StoreApiAddress>;
}): Promise<StoreApiCartResult> {
  const result = await storeApiRequest<StoreApiCart>("/cart/update-customer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(address),
  });
  return toCartResult(result);
}

/** Selects a shipping rate for a package; returns the cart with updated totals. */
export async function selectShippingRate(
  packageId: number | string,
  rateId: string,
): Promise<StoreApiCartResult> {
  const result = await storeApiRequest<StoreApiCart>("/cart/select-shipping-rate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ package_id: packageId, rate_id: rateId }),
  });
  return toCartResult(result);
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
