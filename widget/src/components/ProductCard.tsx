import type { ProductCard } from "../types";

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
  const stock = stockLabel(product.stock_status);
  const addToCartUrl = `${product.permalink}${product.permalink.includes("?") ? "&" : "?"}add-to-cart=${product.id}`;

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
          <span className="dg-price">{formatPrice(product.price)}</span>
          {product.sale_price ? (
            <span className="dg-price-sale">{formatPrice(product.sale_price)}</span>
          ) : null}
          <span className={`dg-stock ${stock.className}`}>{stock.label}</span>
        </div>

        {product.fitment_expected && product.fitment_summary ? (
          <p className="dg-fitment">{product.fitment_summary}</p>
        ) : null}

        <div className="dg-product-actions">
          <a className="dg-btn dg-btn-secondary" href={product.permalink} target="_blank" rel="noopener noreferrer">
            View product
          </a>
          {product.stock_status === "instock" ? (
            <a className="dg-btn dg-btn-primary" href={addToCartUrl} target="_blank" rel="noopener noreferrer">
              Add to cart
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
