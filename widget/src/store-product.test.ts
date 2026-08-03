import { afterEach, describe, expect, it, vi } from "vitest";

function stubWindow(origin = "https://stage2.dieselgeeks.com.au"): void {
  vi.stubGlobal("window", { location: { origin } });
}

function stubFetchJson(options: { ok?: boolean; status?: number; body?: unknown }): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: async () => options.body ?? {},
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("fetchLiveStockStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("maps is_in_stock true to instock", async () => {
    stubWindow();
    stubFetchJson({ body: { is_in_stock: true, is_on_backorder: false } });

    const { fetchLiveStockStatus } = await import("./store-product");
    await expect(fetchLiveStockStatus(1001)).resolves.toBe("instock");
  });

  it("maps is_in_stock false to outofstock", async () => {
    stubWindow();
    stubFetchJson({ body: { is_in_stock: false, is_on_backorder: false } });

    const { fetchLiveStockStatus } = await import("./store-product");
    await expect(fetchLiveStockStatus(1002)).resolves.toBe("outofstock");
  });

  it("maps backorder when not in stock but on backorder", async () => {
    stubWindow();
    stubFetchJson({ body: { is_in_stock: false, is_on_backorder: true } });

    const { fetchLiveStockStatus } = await import("./store-product");
    await expect(fetchLiveStockStatus(99)).resolves.toBe("onbackorder");
  });

  it("returns null on HTTP error without throwing", async () => {
    stubWindow();
    stubFetchJson({ ok: false, status: 404, body: { message: "Not found" } });

    const { fetchLiveStockStatus } = await import("./store-product");
    await expect(fetchLiveStockStatus(99999)).resolves.toBeNull();
  });

  it("caches results per product id", async () => {
    stubWindow();
    const fetchMock = stubFetchJson({ body: { is_in_stock: false, is_on_backorder: false } });

    const { fetchLiveStockStatus } = await import("./store-product");
    await fetchLiveStockStatus(42);
    await fetchLiveStockStatus(42);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
