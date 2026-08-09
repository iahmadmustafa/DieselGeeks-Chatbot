import { afterEach, describe, expect, it, vi } from "vitest";

import { listMyOrders, lookupOrder } from "./orders";

const sampleOrder = {
  id: 15956,
  status: "processing",
  currency: "AUD",
  total: "380.29",
  customer_id: 0,
  date_created: "2026-08-04T02:50:10",
  date_paid: "2026-08-04T02:50:15",
  date_completed: null,
  billing: {
    first_name: "Sam",
    email: "sam@example.com",
  },
  line_items: [{ name: "Injector Kit", quantity: 1, sku: "X", total: "100.00" }],
  shipping_lines: [{ method_title: "Flat Rate" }],
};

describe("lookupOrder / listMyOrders", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the order when guest email matches", async () => {
    vi.stubEnv("WOOCOMMERCE_URL", "https://example.com");
    vi.stubEnv("WOOCOMMERCE_CONSUMER_KEY", "ck");
    vi.stubEnv("WOOCOMMERCE_CONSUMER_SECRET", "cs");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleOrder,
      }),
    );

    const result = await lookupOrder({
      orderId: "#15956",
      email: "Sam@Example.com",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.order.order_id).toBe(15956);
      expect(result.order.status_label).toBe("Processing");
    }
  });

  it("does not reveal existence on email mismatch", async () => {
    vi.stubEnv("WOOCOMMERCE_URL", "https://example.com");
    vi.stubEnv("WOOCOMMERCE_CONSUMER_KEY", "ck");
    vi.stubEnv("WOOCOMMERCE_CONSUMER_SECRET", "cs");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleOrder,
      }),
    );

    const result = await lookupOrder({
      orderId: 15956,
      email: "other@example.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("email_mismatch");
      expect(result.message.toLowerCase()).toContain("no matching order");
    }
  });

  it("allows signed-in owner by customer id without email", async () => {
    vi.stubEnv("WOOCOMMERCE_URL", "https://example.com");
    vi.stubEnv("WOOCOMMERCE_CONSUMER_KEY", "ck");
    vi.stubEnv("WOOCOMMERCE_CONSUMER_SECRET", "cs");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ...sampleOrder, customer_id: 42 }),
      }),
    );

    const result = await lookupOrder({
      orderId: 15956,
      identity: { wpUserId: 42, email: "owner@example.com" },
    });

    expect(result.ok).toBe(true);
  });

  it("blocks signed-in users from looking up someone else's order via that email", async () => {
    vi.stubEnv("WOOCOMMERCE_URL", "https://example.com");
    vi.stubEnv("WOOCOMMERCE_CONSUMER_KEY", "ck");
    vi.stubEnv("WOOCOMMERCE_CONSUMER_SECRET", "cs");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sampleOrder,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupOrder({
      orderId: 15956,
      email: "sam@example.com",
      identity: { wpUserId: 99, email: "ahmad@placentek.com" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("email_mismatch");
    }
    // Reject before Woo fetch when a foreign email is supplied while signed in.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks signed-in users from guest orders that are not theirs", async () => {
    vi.stubEnv("WOOCOMMERCE_URL", "https://example.com");
    vi.stubEnv("WOOCOMMERCE_CONSUMER_KEY", "ck");
    vi.stubEnv("WOOCOMMERCE_CONSUMER_SECRET", "cs");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleOrder,
      }),
    );

    const result = await lookupOrder({
      orderId: 15956,
      identity: { wpUserId: 99, email: "ahmad@placentek.com" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("email_mismatch");
    }
  });

  it("requires login for list_my_orders", async () => {
    const result = await listMyOrders({ identity: null });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("login_required");
    }
  });
});
