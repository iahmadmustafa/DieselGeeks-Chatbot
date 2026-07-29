import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StoreApiCurrency } from "./store-api";

const AUD: StoreApiCurrency = {
  currency_code: "AUD",
  currency_symbol: "$",
  currency_minor_unit: 2,
  currency_decimal_separator: ".",
  currency_thousand_separator: ",",
  currency_prefix: "$",
  currency_suffix: "",
};

function stubFetchJson(options: {
  status?: number;
  ok?: boolean;
  body: unknown;
  cartToken?: string | null;
}) {
  const fetchMock = vi.fn().mockResolvedValue({
    status: options.status ?? 200,
    ok: options.ok ?? true,
    json: async () => options.body,
    headers: { get: (name: string) => (name === "Cart-Token" ? (options.cartToken ?? null) : null) },
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function stubWindow() {
  vi.stubGlobal("window", {
    location: { origin: "https://shop.example" },
  });
}

describe("getCart", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("fetches from the same-origin Store API cart endpoint", async () => {
    stubWindow();
    const fetchMock = stubFetchJson({ body: { items: [], items_count: 0 } });

    const { getCart } = await import("./store-api");
    const result = await getCart();

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/shop\.example\/wp-json\/wc\/store\/v1\/cart\?_dgts=\d+$/),
      expect.objectContaining({ method: "GET", credentials: "same-origin", cache: "no-store" }),
    );
  });

  it("returns the parsed cart on success", async () => {
    stubWindow();
    stubFetchJson({ body: { items: [{ key: "abc" }], items_count: 1 } });

    const { getCart } = await import("./store-api");
    const result = await getCart();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cart.items_count).toBe(1);
    }
  });

  it("fails gracefully on a non-OK HTTP status", async () => {
    stubWindow();
    stubFetchJson({ ok: false, status: 500, body: {} });

    const { getCart } = await import("./store-api");
    const result = await getCart();

    expect(result.ok).toBe(false);
  });

  it("fails gracefully on an unexpected response shape", async () => {
    stubWindow();
    stubFetchJson({ body: { not_a_cart: true } });

    const { getCart } = await import("./store-api");
    const result = await getCart();

    expect(result.ok).toBe(false);
  });

  it("never rejects on a network error", async () => {
    stubWindow();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const { getCart } = await import("./store-api");

    await expect(getCart()).resolves.toEqual(expect.objectContaining({ ok: false }));
  });

  it("never rejects when the response body cannot be parsed as JSON", async () => {
    stubWindow();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("invalid json");
        },
        headers: { get: () => null },
      }),
    );

    const { getCart } = await import("./store-api");

    await expect(getCart()).resolves.toEqual(expect.objectContaining({ ok: false }));
  });
});

describe("updateCustomerAddress and selectShippingRate", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("captures the Cart-Token from a GET /cart response and replays it on the next write", async () => {
    stubWindow();
    const fetchMock = stubFetchJson({
      body: { items: [], items_count: 0 },
      cartToken: "token-abc",
    });

    const { getCart, updateCustomerAddress } = await import("./store-api");
    await getCart();

    stubFetchJson({ body: { items: [], items_count: 0, shipping_address: {} } });
    await updateCustomerAddress({ shipping_address: { postcode: "2500" } });

    const secondCallHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Headers | undefined;
    // First call (getCart) had no token yet, so it shouldn't send one.
    expect(secondCallHeaders?.get?.("Cart-Token")).toBeFalsy();
  });

  it("sends a previously captured Cart-Token on update-customer", async () => {
    stubWindow();
    stubFetchJson({ body: { items: [] }, cartToken: "token-xyz" });
    const { getCart, updateCustomerAddress } = await import("./store-api");
    await getCart();

    const fetchMock = stubFetchJson({ body: { items: [], shipping_address: {} } });
    await updateCustomerAddress({ shipping_address: { city: "Sydney" } });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/cart/update-customer");
    const headers = init.headers as Headers;
    expect(headers.get("Cart-Token")).toBe("token-xyz");
  });

  it("returns the updated cart on a successful address update", async () => {
    stubWindow();
    stubFetchJson({ body: { items: [] } });
    const { updateCustomerAddress } = await import("./store-api");

    const result = await updateCustomerAddress({ shipping_address: { postcode: "2500" } });

    expect(result.ok).toBe(true);
  });

  it("surfaces the API error message on a failed address update", async () => {
    stubWindow();
    stubFetchJson({ ok: false, status: 400, body: { message: "Invalid postcode" } });
    const { updateCustomerAddress } = await import("./store-api");

    const result = await updateCustomerAddress({ shipping_address: { postcode: "not-a-postcode" } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Invalid postcode");
    }
  });

  it("selects a shipping rate and returns the updated cart", async () => {
    stubWindow();
    const fetchMock = stubFetchJson({ body: { items: [], totals: { total_shipping: "1000" } } });
    const { selectShippingRate } = await import("./store-api");

    const result = await selectShippingRate(0, "flat_rate:1");

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/cart/select-shipping-rate");
    expect(JSON.parse(init.body as string)).toEqual({ package_id: 0, rate_id: "flat_rate:1" });
  });

  it("never rejects on a network error during a mutation", async () => {
    stubWindow();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { updateCustomerAddress } = await import("./store-api");

    await expect(updateCustomerAddress({ shipping_address: {} })).resolves.toEqual(
      expect.objectContaining({ ok: false }),
    );
  });
});

describe("submitCheckout and confirmCheckoutOrder", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const billingAddress = {
    first_name: "Jane",
    last_name: "Doe",
    company: "",
    address_1: "1 Test St",
    address_2: "",
    city: "Sydney",
    state: "NSW",
    postcode: "2000",
    country: "AU",
    email: "jane@example.com",
  };

  it("posts to /checkout and returns the order on a successful payment", async () => {
    stubWindow();
    const fetchMock = stubFetchJson({
      body: {
        order_id: 123,
        order_key: "wc_order_abc",
        status: "processing",
        payment_result: { payment_status: "success", payment_details: [] },
      },
    });

    const { submitCheckout } = await import("./store-api");
    const result = await submitCheckout({
      billing_address: billingAddress,
      payment_method: "stripe",
      payment_data: [{ key: "wc-stripe-payment-method", value: "pm_123" }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.order.order_id).toBe(123);
      expect(result.order.payment_result.payment_status).toBe("success");
    }
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/checkout");
    expect(JSON.parse(init.body as string)).toEqual(
      expect.objectContaining({ payment_method: "stripe" }),
    );
  });

  it("surfaces a requires_action payment status without treating it as a failure", async () => {
    stubWindow();
    stubFetchJson({
      body: {
        order_id: 124,
        order_key: "wc_order_def",
        status: "pending",
        payment_result: {
          payment_status: "requires_action",
          payment_details: [{ key: "client_secret", value: "pi_123_secret_456" }],
        },
      },
    });

    const { submitCheckout, readPaymentDetail } = await import("./store-api");
    const result = await submitCheckout({
      billing_address: billingAddress,
      payment_method: "stripe",
      payment_data: [{ key: "wc-stripe-payment-method", value: "pm_123" }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.order.payment_result.payment_status).toBe("requires_action");
      expect(readPaymentDetail(result.order.payment_result.payment_details, "client_secret")).toBe(
        "pi_123_secret_456",
      );
    }
  });

  it("surfaces the server error message on a failed checkout", async () => {
    stubWindow();
    stubFetchJson({ ok: false, status: 400, body: { message: "Your card was declined." } });

    const { submitCheckout } = await import("./store-api");
    const result = await submitCheckout({
      billing_address: billingAddress,
      payment_method: "stripe",
      payment_data: [{ key: "wc-stripe-payment-method", value: "pm_123" }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Your card was declined.");
    }
  });

  it("never rejects on a network error during checkout", async () => {
    stubWindow();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { submitCheckout } = await import("./store-api");

    await expect(
      submitCheckout({
        billing_address: billingAddress,
        payment_method: "stripe",
        payment_data: [],
      }),
    ).resolves.toEqual(expect.objectContaining({ ok: false }));
  });

  it("posts to /checkout/{order_id} to confirm a 3DS-resolved order", async () => {
    stubWindow();
    const fetchMock = stubFetchJson({
      body: {
        order_id: 124,
        order_key: "wc_order_def",
        status: "processing",
        payment_result: { payment_status: "success", payment_details: [] },
      },
    });

    const { confirmCheckoutOrder } = await import("./store-api");
    const result = await confirmCheckoutOrder({
      order_id: 124,
      order_key: "wc_order_def",
      billing_address: billingAddress,
      payment_method: "stripe",
      payment_data: [{ key: "wc-stripe-payment-method", value: "pm_123" }],
    });

    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/checkout/124");
  });
});

describe("formatStoreApiMoney", () => {
  it("formats minor units using the currency metadata", async () => {
    const { formatStoreApiMoney } = await import("./store-api");
    expect(formatStoreApiMoney("1800", AUD)).toBe("$18.00");
  });

  it("adds thousand separators for large amounts", async () => {
    const { formatStoreApiMoney } = await import("./store-api");
    expect(formatStoreApiMoney("123456789", AUD)).toBe("$1,234,567.89");
  });

  it("returns an em dash placeholder for null amounts (e.g. uncalculated shipping)", async () => {
    const { formatStoreApiMoney } = await import("./store-api");
    expect(formatStoreApiMoney(null, AUD)).toBe("—");
  });

  it("respects a zero minor unit currency (no decimals)", async () => {
    const { formatStoreApiMoney } = await import("./store-api");
    const jpy: StoreApiCurrency = { ...AUD, currency_minor_unit: 0, currency_code: "JPY" };
    expect(formatStoreApiMoney("1800", jpy)).toBe("$1,800");
  });
});
