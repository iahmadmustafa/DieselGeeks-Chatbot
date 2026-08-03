const LOG_PREFIX = "[dieselgeeks-chat:store-product]";

export type LiveStockStatus = "instock" | "outofstock" | "onbackorder";

interface StoreProductResponse {
  is_in_stock?: boolean;
  is_on_backorder?: boolean;
}

/** In-memory cache so repeated cards for the same product don't re-fetch. */
const liveStockCache = new Map<number, LiveStockStatus>();

function mapStoreProductStock(data: StoreProductResponse): LiveStockStatus {
  if (data.is_in_stock) {
    return "instock";
  }
  if (data.is_on_backorder) {
    return "onbackorder";
  }
  return "outofstock";
}

/**
 * Reads current purchasability from WooCommerce's public Store API on the
 * same origin as the widget. Catalog search still uses the Redis snapshot
 * (synced periodically), but cards need live stock so badges match the
 * product page shoppers see when they click through.
 */
export async function fetchLiveStockStatus(productId: number): Promise<LiveStockStatus | null> {
  const cached = liveStockCache.get(productId);
  if (cached) {
    return cached;
  }

  const url =
    `${window.location.origin}/wp-json/wc/store/v1/products/${encodeURIComponent(String(productId))}` +
    `?_dgts=${Date.now()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      console.warn(`${LOG_PREFIX} live stock request failed`, { productId, status: response.status });
      return null;
    }

    const data = (await response.json()) as StoreProductResponse;
    const status = mapStoreProductStock(data);
    liveStockCache.set(productId, status);
    return status;
  } catch (error) {
    console.warn(`${LOG_PREFIX} live stock network error`, { productId, error });
    return null;
  }
}
