import * as React from "react";

import { CART_ADDED_EVENT } from "./add-to-cart";
import {
  clearCachedCartToken,
  getCart,
  removeCartItem as removeCartItemApi,
  selectShippingRate as selectShippingRateApi,
  updateCartItemQuantity as updateCartItemQuantityApi,
  updateCustomerAddress as updateCustomerAddressApi,
  type StoreApiAddress,
  type StoreApiCart,
} from "./store-api";

export type StoreCartStatus = "idle" | "loading" | "ready" | "error";

export type StoreCartMutationResult = { ok: true } | { ok: false; error: string };

export interface StoreCartState {
  status: StoreCartStatus;
  cart: StoreApiCart | null;
  error: string | null;
  refresh: () => void;
  updateShippingAddress: (address: Partial<StoreApiAddress>) => Promise<StoreCartMutationResult>;
  selectShippingRate: (packageId: number | string, rateId: string) => Promise<StoreCartMutationResult>;
  removeItem: (itemKey: string) => Promise<StoreCartMutationResult>;
  decrementItem: (itemKey: string, currentQuantity: number) => Promise<StoreCartMutationResult>;
}

/**
 * Shared cart state for the header badge and the cart-review view. Loads
 * once the widget is first opened, then stays fresh by refetching whenever
 * an item is added via `notifyCartAdded` (dispatched by add-to-cart.ts).
 * Also exposes the stage-2 mutations (address + shipping rate selection),
 * which update this same `cart` state from their response so every
 * consumer (badge, cart view) stays in sync without a extra refetch.
 */
export function useStoreCart(enabled: boolean): StoreCartState {
  const [status, setStatus] = React.useState<StoreCartStatus>("idle");
  const [cart, setCart] = React.useState<StoreApiCart | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const hasLoadedRef = React.useRef(false);
  const requestIdRef = React.useRef(0);

  /** Bumps the load generation so any in-flight `getCart()` cannot overwrite a newer mutation result. */
  function invalidateInFlightLoads(): void {
    requestIdRef.current += 1;
  }

  const load = React.useCallback(async () => {
    hasLoadedRef.current = true;
    const requestId = ++requestIdRef.current;
    setStatus("loading");
    setError(null);

    const result = await getCart();

    // Adding several items in quick succession fires several overlapping
    // loads (one per "cart added" event); network timing doesn't guarantee
    // they resolve in the order they were sent. Without this guard, an
    // earlier request finishing last could clobber the UI with a stale,
    // smaller cart snapshot even though the real cart already has more
    // items — discard any response that isn't from the most recent request.
    if (requestId !== requestIdRef.current) {
      return;
    }

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
      // See clearCachedCartToken()'s doc comment: the item was just added via
      // the classic (cookie-based) add-to-cart endpoint, so any Cart-Token we
      // cached before this point can be stale and must not be reused here.
      clearCachedCartToken();
      void load();
    }

    window.addEventListener(CART_ADDED_EVENT, handleCartAdded);
    return () => window.removeEventListener(CART_ADDED_EVENT, handleCartAdded);
  }, [load]);

  const updateShippingAddress = React.useCallback(
    async (address: Partial<StoreApiAddress>): Promise<StoreCartMutationResult> => {
      const result = await updateCustomerAddressApi({ shipping_address: address });
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      invalidateInFlightLoads();
      setCart(result.cart);
      setStatus("ready");
      return { ok: true };
    },
    [],
  );

  const selectShippingRate = React.useCallback(
    async (packageId: number | string, rateId: string): Promise<StoreCartMutationResult> => {
      const result = await selectShippingRateApi(packageId, rateId);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      invalidateInFlightLoads();
      setCart(result.cart);
      setStatus("ready");
      return { ok: true };
    },
    [],
  );

  const removeItem = React.useCallback(async (itemKey: string): Promise<StoreCartMutationResult> => {
    const result = await removeCartItemApi(itemKey);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    invalidateInFlightLoads();
    setCart(result.cart);
    setStatus("ready");
    return { ok: true };
  }, []);

  /**
   * One click of the cart view's remove button should take a stack of
   * multiple units down by one unit, not drop the whole line — dropping
   * straight to `removeCartItemApi` (a full-line delete) was the bug: adding
   * the same product 2-3 times built up quantity on a single line item, and
   * "remove" deleted that entire line in one click instead of one unit.
   * Only the last remaining unit actually removes the line.
   */
  const decrementItem = React.useCallback(
    async (itemKey: string, currentQuantity: number): Promise<StoreCartMutationResult> => {
      if (currentQuantity <= 1) {
        return removeItem(itemKey);
      }

      const result = await updateCartItemQuantityApi(itemKey, currentQuantity - 1);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      invalidateInFlightLoads();
      setCart(result.cart);
      setStatus("ready");
      return { ok: true };
    },
    [removeItem],
  );

  return {
    status,
    cart,
    error,
    refresh: () => void load(),
    updateShippingAddress,
    selectShippingRate,
    removeItem,
    decrementItem,
  };
}
