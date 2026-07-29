import * as React from "react";

import { CART_ADDED_EVENT, type CartAddedDetail } from "../add-to-cart";

const TOAST_DURATION_MS = 2800;

export function CartToast() {
  const [toast, setToast] = React.useState<CartAddedDetail | null>(null);
  const timeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    function handleCartAdded(event: Event): void {
      const detail = (event as CustomEvent<CartAddedDetail>).detail;
      if (!detail?.productTitle) {
        return;
      }

      setToast(detail);

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setToast(null);
        timeoutRef.current = null;
      }, TOAST_DURATION_MS);
    }

    window.addEventListener(CART_ADDED_EVENT, handleCartAdded);
    return () => {
      window.removeEventListener(CART_ADDED_EVENT, handleCartAdded);
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!toast) {
    return null;
  }

  return (
    <div className="dg-cart-toast" role="status" aria-live="polite">
      <span className="dg-cart-toast-icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M6 6h15l-1.5 9h-12L4 3H1"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="20" r="1.4" fill="currentColor" />
          <circle cx="18" cy="20" r="1.4" fill="currentColor" />
        </svg>
      </span>
      <span className="dg-cart-toast-copy">
        <strong>Added to cart</strong>
        <span>{toast.productTitle}</span>
      </span>
    </div>
  );
}
