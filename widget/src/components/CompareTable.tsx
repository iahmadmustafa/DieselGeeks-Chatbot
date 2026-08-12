import * as React from "react";

import { addProductToCart, notifyCartAdded } from "../add-to-cart";
import { fetchLiveStockStatus, type LiveStockStatus } from "../store-product";
import type { ProductCard } from "../types";
import { CartIcon, CheckIcon } from "./Icons";

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

function CompareColumn({ product }: { product: ProductCard }) {
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
      notifyCartAdded({ productId: product.id, productTitle: product.title });
      setAddState("added");
      successTimeoutRef.current = window.setTimeout(() => {
        setAddState("idle");
        successTimeoutRef.current = null;
      }, 1600);
    } catch (error) {
      console.error("[dieselgeeks-chat:compare-add] unexpected error", error);
      setAddError("Could not add item to cart.");
      setAddState("idle");
    }
  }

  return (
    <div className="dg-compare-col">
      <div className="dg-compare-image-wrap">
        {product.image_url ? (
          <img className="dg-compare-image" src={product.image_url} alt="" loading="lazy" />
        ) : (
          <div className="dg-compare-image-fallback">No image</div>
        )}
      </div>
      <h4 className="dg-compare-title">{product.title}</h4>

      <div className="dg-compare-row">
        <span className="dg-compare-label">Price</span>
        <span className="dg-compare-value dg-price-group">
          <span className="dg-price">{formatPrice(product.price)}</span>
          {product.sale_price ? (
            <span className="dg-price-sale">{formatPrice(product.sale_price)}</span>
          ) : null}
        </span>
      </div>

      <div className="dg-compare-row">
        <span className="dg-compare-label">SKU</span>
        <span className="dg-compare-value">{product.sku || "—"}</span>
      </div>

      <div className="dg-compare-row">
        <span className="dg-compare-label">Stock</span>
        <span className={`dg-compare-value dg-stock ${stock.className}`}>{stock.label}</span>
      </div>

      <div className="dg-compare-row dg-compare-row-fitment">
        <span className="dg-compare-label">Fitment</span>
        <span className="dg-compare-value">
          {product.fitment_expected && product.fitment_summary ? product.fitment_summary : "—"}
        </span>
      </div>

      <div className="dg-compare-actions">
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
  );
}

export function CompareTable({ products }: { products: ProductCard[] }) {
  const columns = products.slice(0, 3);
  if (columns.length < 2) {
    return null;
  }

  return (
    <div
      className={`dg-compare dg-compare-cols-${columns.length}`}
      role="region"
      aria-label="Product comparison"
    >
      <div className="dg-compare-scroll">
        {columns.map((product) => (
          <CompareColumn key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
