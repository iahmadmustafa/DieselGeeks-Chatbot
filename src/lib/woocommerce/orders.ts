/**
 * Server-side WooCommerce order lookups for the chat assistant.
 * Never expose raw billing/shipping addresses or payment URLs to the model.
 */

function getWooConfig(): { baseUrl: string; consumerKey: string; consumerSecret: string } {
  const baseUrl = process.env.WOOCOMMERCE_URL?.replace(/\/$/, "");
  const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY;
  const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET;

  if (!baseUrl || !consumerKey || !consumerSecret) {
    throw new Error(
      "WOOCOMMERCE_URL, WOOCOMMERCE_CONSUMER_KEY, and WOOCOMMERCE_CONSUMER_SECRET are required",
    );
  }

  return { baseUrl, consumerKey, consumerSecret };
}

function appendWooAuthParams(url: URL, consumerKey: string, consumerSecret: string): void {
  url.searchParams.set("consumer_key", consumerKey);
  url.searchParams.set("consumer_secret", consumerSecret);
}

interface WooOrderLineItem {
  id?: number;
  name?: string;
  quantity?: number;
  sku?: string;
  total?: string;
}

interface WooOrderBilling {
  email?: string;
  first_name?: string;
  last_name?: string;
}

export interface WooOrderRaw {
  id: number;
  status: string;
  currency?: string;
  total?: string;
  customer_id?: number;
  date_created?: string;
  date_paid?: string | null;
  date_completed?: string | null;
  billing?: WooOrderBilling;
  line_items?: WooOrderLineItem[];
  shipping_lines?: Array<{ method_title?: string }>;
}

export interface OrderSummary {
  order_id: number;
  status: string;
  status_label: string;
  currency: string;
  total: string;
  date_created: string | null;
  date_paid: string | null;
  date_completed: string | null;
  item_count: number;
  items: Array<{ name: string; quantity: number; sku: string; line_total: string }>;
  shipping_method: string | null;
  customer_first_name: string | null;
}

export type OrderLookupResult =
  | { ok: true; order: OrderSummary }
  | {
      ok: false;
      error:
        | "not_found"
        | "email_mismatch"
        | "unauthorized"
        | "invalid_input"
        | "woo_unavailable";
      message: string;
    };

export type MyOrdersResult =
  | { ok: true; orders: OrderSummary[]; count: number }
  | {
      ok: false;
      error: "login_required" | "woo_unavailable";
      message: string;
    };

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending payment",
  processing: "Processing",
  "on-hold": "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Failed",
  trash: "Removed",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/-/g, " ");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseOrderId(value: string | number): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  const digits = String(value).replace(/[^\d]/g, "");
  if (!digits) {
    return null;
  }
  const id = Number.parseInt(digits, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function toOrderSummary(order: WooOrderRaw): OrderSummary {
  const items = (order.line_items ?? []).map((item) => ({
    name: (item.name ?? "Item").trim(),
    quantity: typeof item.quantity === "number" ? item.quantity : 1,
    sku: (item.sku ?? "").trim(),
    line_total: (item.total ?? "").trim(),
  }));

  return {
    order_id: order.id,
    status: order.status,
    status_label: statusLabel(order.status),
    currency: order.currency ?? "AUD",
    total: order.total ?? "0.00",
    date_created: order.date_created ?? null,
    date_paid: order.date_paid ?? null,
    date_completed: order.date_completed ?? null,
    item_count: items.reduce((sum, item) => sum + item.quantity, 0),
    items,
    shipping_method: order.shipping_lines?.[0]?.method_title?.trim() || null,
    customer_first_name: order.billing?.first_name?.trim() || null,
  };
}

async function fetchOrderById(orderId: number): Promise<WooOrderRaw | null> {
  const { baseUrl, consumerKey, consumerSecret } = getWooConfig();
  const url = new URL(`${baseUrl}/wp-json/wc/v3/orders/${orderId}`);
  appendWooAuthParams(url, consumerKey, consumerSecret);

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WooCommerce order API error ${response.status}: ${body}`);
  }

  return (await response.json()) as WooOrderRaw;
}

async function fetchOrdersByCustomer(customerId: number, perPage = 5): Promise<WooOrderRaw[]> {
  const { baseUrl, consumerKey, consumerSecret } = getWooConfig();
  const url = new URL(`${baseUrl}/wp-json/wc/v3/orders`);
  url.searchParams.set("customer", String(customerId));
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("orderby", "date");
  url.searchParams.set("order", "desc");
  appendWooAuthParams(url, consumerKey, consumerSecret);

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WooCommerce orders list API error ${response.status}: ${body}`);
  }

  return (await response.json()) as WooOrderRaw[];
}

const ORDER_NOT_YOURS_MESSAGE =
  "No matching order was found for that order number and email. Check both, or sign in with the account used at checkout.";

/**
 * Guest or logged-in lookup.
 *
 * - Guests: order number + checkout email must match the order.
 * - Signed-in: only orders owned by that account (WP customer id or the
 *   account's own billing email). A different email in the tool args is
 *   ignored/rejected so users can't pivot to someone else's order mid-chat.
 */
export async function lookupOrder(options: {
  orderId: string | number;
  email?: string | null;
  identity?: { wpUserId: number; email: string } | null;
}): Promise<OrderLookupResult> {
  const orderId = parseOrderId(options.orderId);
  if (!orderId) {
    return {
      ok: false,
      error: "invalid_input",
      message: "Please provide a valid order number.",
    };
  }

  const providedEmail = options.email ? normalizeEmail(options.email) : "";
  const identityEmail = options.identity?.email ? normalizeEmail(options.identity.email) : "";
  const identityUserId = options.identity?.wpUserId ?? null;
  const isSignedIn = Boolean(identityUserId && identityEmail);

  if (!isSignedIn && !providedEmail) {
    return {
      ok: false,
      error: "invalid_input",
      message:
        "To look up an order, ask for the order number and the email used at checkout, or ask the customer to sign in.",
    };
  }

  // Signed-in users may only query with their own email (or omit it).
  if (isSignedIn && providedEmail && providedEmail !== identityEmail) {
    return {
      ok: false,
      error: "email_mismatch",
      message: ORDER_NOT_YOURS_MESSAGE,
    };
  }

  let order: WooOrderRaw | null;
  try {
    order = await fetchOrderById(orderId);
  } catch (error) {
    console.error("[woo-orders] lookup failed", error);
    return {
      ok: false,
      error: "woo_unavailable",
      message: "Order lookup is temporarily unavailable. Please try again shortly.",
    };
  }

  if (!order) {
    return {
      ok: false,
      error: "not_found",
      message: "No order was found with that number. Double-check the order number from the confirmation email.",
    };
  }

  const orderEmail = normalizeEmail(order.billing?.email ?? "");
  const ownsAsCustomer =
    identityUserId != null &&
    typeof order.customer_id === "number" &&
    order.customer_id > 0 &&
    order.customer_id === identityUserId;
  const ownsByIdentityEmail = Boolean(identityEmail && orderEmail && identityEmail === orderEmail);
  const ownsByGuestEmail =
    !isSignedIn && Boolean(providedEmail && orderEmail && providedEmail === orderEmail);

  const allowed = isSignedIn
    ? ownsAsCustomer || ownsByIdentityEmail
    : ownsByGuestEmail;

  if (!allowed) {
    // Same generic wording — don't reveal that the order exists for another email.
    return {
      ok: false,
      error: "email_mismatch",
      message: ORDER_NOT_YOURS_MESSAGE,
    };
  }

  return { ok: true, order: toOrderSummary(order) };
}

export async function listMyOrders(options: {
  identity: { wpUserId: number; email: string } | null;
  limit?: number;
}): Promise<MyOrdersResult> {
  if (!options.identity?.wpUserId) {
    return {
      ok: false,
      error: "login_required",
      message:
        "The customer needs to sign in to list their recent orders. Guests can look up a single order with order number + checkout email instead.",
    };
  }

  const limit = Math.min(Math.max(options.limit ?? 5, 1), 10);

  try {
    const orders = await fetchOrdersByCustomer(options.identity.wpUserId, limit);
    return {
      ok: true,
      orders: orders.map(toOrderSummary),
      count: orders.length,
    };
  } catch (error) {
    console.error("[woo-orders] list failed", error);
    return {
      ok: false,
      error: "woo_unavailable",
      message: "Order lookup is temporarily unavailable. Please try again shortly.",
    };
  }
}
