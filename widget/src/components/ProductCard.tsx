import * as React from "react";

import { addProductToCart, notifyCartAdded } from "../add-to-cart";
import { fetchLiveStockStatus, type LiveStockStatus } from "../store-product";
import type { ProductCard } from "../types";
import { CartIcon, CheckIcon } from "./Icons";

const SUCCESS_DISPLAY_MS = 1600;

type AddState = "idle" | "adding" | "added";

function formatPrice(price: string): string {
  const numeric = Number(price);
  if (Number.isNaN(numeric)) {
    return price.startsWith("$") ? price : `$${price}`;
  }

  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(numeric);
}

function stockLabel(status: string): { label: string; className: string } {
  switch (status) {
    case "instock":
      return { label: "In stock", className: "dg-stock-instock" };
    case "outofstock":
      return { label: "Out of stock", className: "dg-stock-outofstock" };
    case "onbackorder":
      return { label: "On backorder", className: "dg-stock-onbackorder" };
    default:
      return { label: status, className: "dg-stock-onbackorder" };
  }
}

export function ProductCardView({ product }: { product: ProductCard }) {
  const [liveStockStatus, setLiveStockStatus] = React.useState<LiveStockStatus | null>(null);
  const stockStatus = liveStockStatus ?? product.stock_status;
  const stock = stockLabel(stockStatus);
  const [addState, setAddState] = React.useState<AddState>("idle");
  const [addError, setAddError] = React.useState<string | null>(null);
  const successTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    void fetchLiveStockStatus(product.id).then((status) => {
      if (!cancelled && status) {
        setLiveStockStatus(status);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [product.id]);

  React.useEffect(() => {
    return () => {
      if (successTimeoutRef.current !== null) {
        window.clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  async function handleAddToCart(): Promise<void> {
    if (addState === "adding") {
      return;
    }

    setAddError(null);
    setAddState("adding");

    try {
      const result = await addProductToCart(product.id);

      if (!result.ok) {
        setAddError(result.error ?? "Could not add item to cart.");
        setAddState("idle");
        return;
      }

      notifyCartAdded({
        productId: product.id,
        productTitle: product.title,
      });

      setAddState("added");
      successTimeoutRef.current = window.setTimeout(() => {
        setAddState("idle");
        successTimeoutRef.current = null;
      }, SUCCESS_DISPLAY_MS);
    } catch (error) {
      // addProductToCart is designed to never throw, but guard anyway so the
      // button can never get stuck on "Adding..." if something unexpected happens.
      console.error("[dieselgeeks-chat:add-to-cart] unexpected error", error);
      setAddError("Could not add item to cart.");
      setAddState("idle");
    }
  }

  return (
    <article className="dg-product-card">
      <div className="dg-product-image-wrap">
        {product.image_url ? (
          <img className="dg-product-image" src={product.image_url} alt={product.title} loading="lazy" />
        ) : (
          <div className="dg-product-image-fallback">No image</div>
        )}
      </div>

      <div className="dg-product-body">
        <h4 className="dg-product-title">{product.title}</h4>

        <div className="dg-product-meta">
          <span className="dg-price-group">
            <span className="dg-price">{formatPrice(product.price)}</span>
            {product.sale_price ? (
              <span className="dg-price-sale">{formatPrice(product.sale_price)}</span>
            ) : null}
          </span>
          <span className={`dg-stock ${stock.className}`}>{stock.label}</span>
        </div>

        {product.fitment_expected && product.fitment_summary ? (
          <p className="dg-fitment">{product.fitment_summary}</p>
        ) : null}

        <div className="dg-product-actions">
          <a className="dg-btn dg-btn-secondary" href={product.permalink} target="_blank" rel="noopener noreferrer">
            View product
          </a>
          {stockStatus === "instock" ? (
            <button
              type="button"
              className={`dg-btn ${addState === "added" ? "dg-btn-success" : "dg-btn-primary"}`}
              onClick={() => void handleAddToCart()}
              disabled={addState === "adding"}
            >
              {addState === "adding" ? (
                <>
                  <span className="dg-spinner" aria-hidden="true" />
                  Adding
                </>
              ) : addState === "added" ? (
                <>
                  <CheckIcon className="dg-btn-icon" />
                  Added
                </>
              ) : (
                <>
                  <CartIcon className="dg-btn-icon" />
                  Add to cart
                </>
              )}
            </button>
          ) : null}
        </div>
        {addError ? <p className="dg-product-error">{addError}</p> : null}
      </div>
    </article>
  );
}
