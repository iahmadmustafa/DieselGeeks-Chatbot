import * as React from "react";

import {
  clearCachedCartToken,
  formatStoreApiMoney,
  type StoreApiAddress,
  type StoreApiCart,
  type StoreApiOrder,
} from "../store-api";
import type { StoreCartMutationResult, StoreCartStatus } from "../use-store-cart";
import { CartShippingSection } from "./CartShippingSection";
import { CartIcon, CheckIcon, TrashIcon } from "./Icons";
import { PaymentStep } from "./PaymentStep";

interface CartReviewProps {
  cart: StoreApiCart | null;
  status: StoreCartStatus;
  error: string | null;
  onRefresh: () => void;
  onBack: () => void;
  onUpdateAddress: (address: Partial<StoreApiAddress>) => Promise<StoreCartMutationResult>;
  onSelectRate: (packageId: number | string, rateId: string) => Promise<StoreCartMutationResult>;
  onRemoveItem: (itemKey: string) => Promise<StoreCartMutationResult>;
}

/**
 * Read-only cart review — stage 1 of in-chat checkout. Deliberately has no
 * quantity editing, coupon, or payment UI yet; "Review & checkout" hands off
 * to the store's normal cart page so a purchase can always be completed
 * safely while later stages (address/shipping, then payment) are built.
 */
export function CartReview({
  cart,
  status,
  error,
  onRefresh,
  onBack,
  onUpdateAddress,
  onSelectRate,
  onRemoveItem,
}: CartReviewProps) {
  const cartUrl = `${window.location.origin}/cart/`;
  const isEmpty = status === "ready" && (!cart || cart.items.length === 0);
  const isPopulated = status === "ready" && !!cart && cart.items.length > 0;
  const [completedOrder, setCompletedOrder] = React.useState<StoreApiOrder | null>(null);
  const [removingKey, setRemovingKey] = React.useState<string | null>(null);
  const [removeError, setRemoveError] = React.useState<string | null>(null);

  async function handleRemoveItem(itemKey: string): Promise<void> {
    setRemoveError(null);
    setRemovingKey(itemKey);
    const result = await onRemoveItem(itemKey);
    setRemovingKey(null);
    if (!result.ok) {
      setRemoveError(result.error);
    }
  }

  const readyForPayment =
    !!cart && cart.needs_payment && (!cart.needs_shipping || cart.has_calculated_shipping);

  function handleOrderComplete(order: StoreApiOrder): void {
    // A completed order converts the cart it came from and WooCommerce
    // issues a new session/cart for whatever comes next — reusing the old
    // `Cart-Token` after this point gets rejected server-side with "CSRF
    // verification failed" (confirmed live: it started appearing on the very
    // next checkout attempt in the same widget session right after a prior
    // order succeeded). Dropping it forces the next request back onto
    // cookie-based identification, the same fix already used for the
    // add-to-cart/incognito cart-sync bug above.
    clearCachedCartToken();
    setCompletedOrder(order);
  }

  function handleDone(): void {
    setCompletedOrder(null);
    onRefresh();
    onBack();
  }

  if (completedOrder) {
    return (
      <div className="dg-cart-view">
        <div className="dg-cart-view-body dg-order-confirmation">
          <span className="dg-order-confirmation-icon" aria-hidden="true">
            <CheckIcon size={28} />
          </span>
          <h4>Order confirmed</h4>
          <p>
            Order #{completedOrder.order_id} is on its way. We've sent a receipt to your email — thanks for
            shopping with Diesel Geeks!
          </p>
          <button type="button" className="dg-btn dg-btn-primary" onClick={handleDone}>
            Back to chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dg-cart-view">
      <div className="dg-cart-view-toolbar">
        <button type="button" className="dg-cart-back" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M10 3L5 8l5 5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to chat
        </button>
        <button type="button" className="dg-icon-btn" onClick={onRefresh} aria-label="Refresh cart">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M13.5 8a5.5 5.5 0 1 1-1.6-3.88M13.5 2.5v3.5H10"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="dg-cart-view-body">
        {status === "loading" || status === "idle" ? <p className="dg-cart-status">Loading your cart…</p> : null}

        {status === "error" ? (
          <div className="dg-cart-status dg-cart-status-error">
            <p>{error ?? "Could not load your cart."}</p>
            <button type="button" className="dg-btn dg-btn-secondary" onClick={onRefresh}>
              Try again
            </button>
          </div>
        ) : null}

        {isEmpty ? (
          <div className="dg-cart-status">
            <p>Your cart is empty.</p>
            <p className="dg-cart-status-hint">Ask me to find a part, then add it to your cart from here.</p>
          </div>
        ) : null}

        {isPopulated && cart ? (
          <>
            {removeError ? <p className="dg-cart-shipping-error">{removeError}</p> : null}
            <ul className="dg-cart-items">
              {cart.items.map((item) => {
                const image = item.images[0];
                const isRemoving = removingKey === item.key;
                return (
                  <li className="dg-cart-item" key={item.key}>
                    <div className="dg-cart-item-image">
                      {image ? (
                        <img src={image.thumbnail || image.src} alt={image.alt || item.name} loading="lazy" />
                      ) : (
                        <div className="dg-cart-item-image-fallback" aria-hidden="true" />
                      )}
                    </div>
                    <div className="dg-cart-item-body">
                      <p className="dg-cart-item-name">{item.name}</p>
                      <p className="dg-cart-item-meta">
                        Qty {item.quantity} · {formatStoreApiMoney(item.prices.price, item.prices)} each
                      </p>
                    </div>
                    <div className="dg-cart-item-total">
                      {formatStoreApiMoney(item.totals.line_total, item.totals)}
                    </div>
                    <button
                      type="button"
                      className="dg-cart-item-remove"
                      onClick={() => void handleRemoveItem(item.key)}
                      disabled={isRemoving}
                      aria-label={`Remove ${item.name} from cart`}
                      title="Remove from cart"
                    >
                      {isRemoving ? <span className="dg-spinner" aria-hidden="true" /> : <TrashIcon size={14} />}
                    </button>
                  </li>
                );
              })}
            </ul>

            {cart.needs_shipping ? (
              <CartShippingSection cart={cart} onUpdateAddress={onUpdateAddress} onSelectRate={onSelectRate} />
            ) : null}

            <div className="dg-cart-summary">
              <div className="dg-cart-summary-row">
                <span>Subtotal</span>
                <span>{formatStoreApiMoney(cart.totals.total_items, cart.totals)}</span>
              </div>
              {Number(cart.totals.total_discount) > 0 ? (
                <div className="dg-cart-summary-row">
                  <span>Discount</span>
                  <span>-{formatStoreApiMoney(cart.totals.total_discount, cart.totals)}</span>
                </div>
              ) : null}
              <div className="dg-cart-summary-row">
                <span>Shipping</span>
                <span>
                  {cart.has_calculated_shipping && cart.totals.total_shipping !== null
                    ? formatStoreApiMoney(cart.totals.total_shipping, cart.totals)
                    : "Calculated at checkout"}
                </span>
              </div>
              {(cart.fees ?? []).map((fee) => (
                <div className="dg-cart-summary-fee-group" key={fee.key}>
                  {Number(fee.totals.total) !== 0 ? (
                    <div className="dg-cart-summary-row">
                      <span>{fee.name}</span>
                      <span>{formatStoreApiMoney(fee.totals.total, fee.totals)}</span>
                    </div>
                  ) : null}
                  {Number(fee.totals.total_tax) > 0 ? (
                    <div className="dg-cart-summary-row">
                      <span>{fee.name} GST</span>
                      <span>{formatStoreApiMoney(fee.totals.total_tax, fee.totals)}</span>
                    </div>
                  ) : null}
                </div>
              ))}
              {Number(cart.totals.total_tax) > 0 ? (
                <div className="dg-cart-summary-row">
                  <span>Tax</span>
                  <span>{formatStoreApiMoney(cart.totals.total_tax, cart.totals)}</span>
                </div>
              ) : null}
              <div className="dg-cart-summary-row dg-cart-summary-total">
                <span>Total</span>
                <span>{formatStoreApiMoney(cart.totals.total_price, cart.totals)}</span>
              </div>
            </div>

            {readyForPayment ? <PaymentStep cart={cart} onOrderComplete={handleOrderComplete} /> : null}
          </>
        ) : null}
      </div>

      <div className="dg-cart-view-footer">
        <a className="dg-btn dg-btn-secondary dg-cart-checkout-link" href={cartUrl}>
          <CartIcon className="dg-btn-icon" size={14} />
          Open full cart page instead
        </a>
        <p className="dg-cart-view-note">
          Prefer the full site? This opens your cart on dieselgeeks.com.au to complete the order there instead.
        </p>
      </div>
    </div>
  );
}
