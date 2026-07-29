import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

function stubFetchResponse(options: { status?: number; ok?: boolean; body: string }) {
  const fetchMock = vi.fn().mockResolvedValue({
    status: options.status ?? 200,
    ok: options.ok ?? true,
    text: async () => options.body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function stubWindow(extra: Record<string, unknown> = {}) {
  vi.stubGlobal("window", {
    location: { origin: "https://shop.example" },
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    ...extra,
  });
  vi.stubGlobal("location", { origin: "https://shop.example" });
}

describe("addProductToCart success detection", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("treats the standard WooCommerce success shape as success", async () => {
    stubWindow();
    stubFetchResponse({ body: JSON.stringify({ fragments: { ".cart": "<div/>" }, cart_hash: "abc" }) });

    const { addProductToCart } = await import("./add-to-cart");
    const result = await addProductToCart(123);

    expect(result.ok).toBe(true);
  });

  it("treats error: false as success, not failure", async () => {
    stubWindow();
    stubFetchResponse({ body: JSON.stringify({ error: false, fragments: {} }) });

    const { addProductToCart } = await import("./add-to-cart");
    const result = await addProductToCart(123);

    expect(result.ok).toBe(true);
  });

  it("treats a response with no fragments/error keys as success", async () => {
    stubWindow();
    stubFetchResponse({ body: JSON.stringify({ success: true }) });

    const { addProductToCart } = await import("./add-to-cart");
    const result = await addProductToCart(123);

    expect(result.ok).toBe(true);
  });

  it("salvages JSON preceded by PHP notices/warnings and reports success", async () => {
    stubWindow();
    stubFetchResponse({
      body:
        "<br />\n<b>Notice</b>: Undefined index in plugin.php on line 42<br />\n" +
        JSON.stringify({ fragments: { ".cart": "<div/>" }, cart_hash: "abc" }),
    });

    const { addProductToCart } = await import("./add-to-cart");
    const result = await addProductToCart(123);

    expect(result.ok).toBe(true);
  });

  it("treats error: true as a genuine failure", async () => {
    stubWindow();
    stubFetchResponse({ body: JSON.stringify({ error: true, product_url: "https://shop.example/p/1" }) });

    const { addProductToCart } = await import("./add-to-cart");
    const result = await addProductToCart(123);

    expect(result.ok).toBe(false);
  });

  it("treats a non-empty error message string as a genuine failure", async () => {
    stubWindow();
    stubFetchResponse({ body: JSON.stringify({ error: "Out of stock" }) });

    const { addProductToCart } = await import("./add-to-cart");
    const result = await addProductToCart(123);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Out of stock");
  });

  it("treats an empty error string as success, not failure", async () => {
    stubWindow();
    stubFetchResponse({ body: JSON.stringify({ error: "", fragments: {} }) });

    const { addProductToCart } = await import("./add-to-cart");
    const result = await addProductToCart(123);

    expect(result.ok).toBe(true);
  });

  it("falls back to HTTP status when the body is not parseable JSON", async () => {
    stubWindow();
    stubFetchResponse({ body: "" });

    const { addProductToCart } = await import("./add-to-cart");
    const result = await addProductToCart(123);

    expect(result.ok).toBe(true);
  });

  it("fails when the body is unparseable and the HTTP status is not OK", async () => {
    stubWindow();
    stubFetchResponse({ ok: false, status: 500, body: "Internal Server Error" });

    const { addProductToCart } = await import("./add-to-cart");
    const result = await addProductToCart(123);

    expect(result.ok).toBe(false);
  });

  it("logs the raw response status and body for debugging", async () => {
    stubWindow();
    stubFetchResponse({ body: JSON.stringify({ fragments: {} }) });
    const logSpy = vi.spyOn(console, "log");

    const { addProductToCart } = await import("./add-to-cart");
    await addProductToCart(123);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("add-to-cart"),
      expect.objectContaining({ status: 200, ok: true, body: expect.any(String) }),
    );
  });

  it("uses wc_add_to_cart_params when available", async () => {
    stubWindow({
      wc_add_to_cart_params: {
        wc_ajax_url: "https://shop.example/?wc-ajax=%%endpoint%%",
      },
    });
    const fetchMock = stubFetchResponse({ body: JSON.stringify({ fragments: {} }) });

    const { addProductToCart } = await import("./add-to-cart");
    await addProductToCart(123);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://shop.example/?wc-ajax=add_to_cart",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
