import * as React from "react";

import { CART_ADDED_EVENT } from "./add-to-cart";
import { getCart, type StoreApiCart } from "./store-api";

export type StoreCartStatus = "idle" | "loading" | "ready" | "error";

export interface StoreCartState {
  status: StoreCartStatus;
  cart: StoreApiCart | null;
  error: string | null;
  refresh: () => void;
}

/**
 * Shared cart state for the header badge and the cart-review view. Loads
 * once the widget is first opened, then stays fresh by refetching whenever
 * an item is added via `notifyCartAdded` (dispatched by add-to-cart.ts).
 */
export function useStoreCart(enabled: boolean): StoreCartState {
  const [status, setStatus] = React.useState<StoreCartStatus>("idle");
  const [cart, setCart] = React.useState<StoreApiCart | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const hasLoadedRef = React.useRef(false);

  const load = React.useCallback(async () => {
    hasLoadedRef.current = true;
    setStatus("loading");
    setError(null);

    const result = await getCart();
    if (!result.ok) {
      setStatus("error");
      setError(result.error);
      return;
    }

    setCart(result.cart);
    setStatus("ready");
  }, []);

  React.useEffect(() => {
    if (!enabled || hasLoadedRef.current) {
      return;
    }
    void load();
  }, [enabled, load]);

  React.useEffect(() => {
    function handleCartAdded() {
      void load();
    }

    window.addEventListener(CART_ADDED_EVENT, handleCartAdded);
    return () => window.removeEventListener(CART_ADDED_EVENT, handleCartAdded);
  }, [load]);

  return { status, cart, error, refresh: () => void load() };
}
