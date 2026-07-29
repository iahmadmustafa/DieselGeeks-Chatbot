import * as React from "react";

import { CART_ADDED_EVENT, type CartAddedDetail } from "../add-to-cart";
import { CartIcon } from "./Icons";

const TOAST_DURATION_MS = 2800;
const EXIT_DURATION_MS = 160;

/**
 * Renders the floating "Added to cart" confirmation shown anywhere on the
 * host page. While the chat panel itself is open, the product card already
 * shows its own inline "Added" state, so this floating toast is suppressed
 * to avoid stacking a second confirmation on top of the panel/launcher.
 */
export function CartToast({ isChatOpen }: { isChatOpen: boolean }) {
  const [toast, setToast] = React.useState<CartAddedDetail | null>(null);
  const [isExiting, setIsExiting] = React.useState(false);
  const hideTimeoutRef = React.useRef<number | null>(null);
  const removeTimeoutRef = React.useRef<number | null>(null);
  const isChatOpenRef = React.useRef(isChatOpen);

  React.useEffect(() => {
    isChatOpenRef.current = isChatOpen;
    if (isChatOpen) {
      setToast(null);
      setIsExiting(false);
    }
  }, [isChatOpen]);

  React.useEffect(() => {
    function clearTimers(): void {
      if (hideTimeoutRef.current !== null) {
        window.clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      if (removeTimeoutRef.current !== null) {
        window.clearTimeout(removeTimeoutRef.current);
        removeTimeoutRef.current = null;
      }
    }

    function handleCartAdded(event: Event): void {
      if (isChatOpenRef.current) {
        return;
      }

      const detail = (event as CustomEvent<CartAddedDetail>).detail;
      if (!detail?.productTitle) {
        return;
      }

      clearTimers();
      setIsExiting(false);
      setToast(detail);

      hideTimeoutRef.current = window.setTimeout(() => {
        setIsExiting(true);
        removeTimeoutRef.current = window.setTimeout(() => {
          setToast(null);
          setIsExiting(false);
          removeTimeoutRef.current = null;
        }, EXIT_DURATION_MS);
      }, TOAST_DURATION_MS);
    }

    window.addEventListener(CART_ADDED_EVENT, handleCartAdded);
    return () => {
      window.removeEventListener(CART_ADDED_EVENT, handleCartAdded);
      clearTimers();
    };
  }, []);

  if (!toast) {
    return null;
  }

  return (
    <div
      className={`dg-cart-toast${isExiting ? " dg-cart-toast-exiting" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="dg-cart-toast-icon" aria-hidden="true">
        <CartIcon size={18} />
      </span>
      <span className="dg-cart-toast-copy">
        <strong>Added to cart</strong>
        <span>{toast.productTitle}</span>
      </span>
    </div>
  );
}
