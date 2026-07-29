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

function stubFetchJson(options: { status?: number; ok?: boolean; body: unknown }) {
  const fetchMock = vi.fn().mockResolvedValue({
    status: options.status ?? 200,
    ok: options.ok ?? true,
    json: async () => options.body,
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
      "https://shop.example/wp-json/wc/store/v1/cart",
      expect.objectContaining({ method: "GET", credentials: "same-origin" }),
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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    const { getCart } = await import("./store-api");

    await expect(getCart()).resolves.toEqual(
      expect.objectContaining({ ok: false }),
    );
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
      }),
    );

    const { getCart } = await import("./store-api");

    await expect(getCart()).resolves.toEqual(
      expect.objectContaining({ ok: false }),
    );
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
