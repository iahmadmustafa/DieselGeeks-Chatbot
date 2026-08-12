import type { ChatUIMessage, ProductCard } from "./types";

export interface ProductComparison {
  products: ProductCard[];
}

function isProductCard(value: unknown): value is ProductCard {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as ProductCard;
  return typeof candidate.id === "number" && typeof candidate.title === "string";
}

/**
 * Side-by-side compare payload from compare_products for this assistant turn.
 * Kept separate from search product cards so the desktop right panel does not
 * treat a comparison as another product-card dump.
 */
export function getComparisonFromMessage(message: ChatUIMessage): ProductComparison | null {
  for (const part of message.parts) {
    if (
      part.type === "tool-compare_products" &&
      part.state === "output-available" &&
      part.output &&
      typeof part.output === "object"
    ) {
      const output = part.output as {
        ok?: boolean;
        products?: unknown;
      };
      if (output.ok === true && Array.isArray(output.products)) {
        const products = output.products.filter(isProductCard);
        if (products.length >= 2) {
          return { products: products.slice(0, 3) };
        }
      }
    }
  }

  return null;
}
