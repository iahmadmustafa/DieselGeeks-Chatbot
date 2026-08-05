import type { ChatUIMessage, ProductCard } from "./types";

export function getProductsFromMessage(message: ChatUIMessage): ProductCard[] {
  const products: ProductCard[] = [];

  for (const part of message.parts) {
    if (part.type === "data-products" && Array.isArray(part.data)) {
      products.push(...part.data);
      continue;
    }

    if (
      part.type === "tool-search_products" &&
      part.state === "output-available" &&
      part.output &&
      typeof part.output === "object" &&
      "products" in part.output &&
      Array.isArray(part.output.products)
    ) {
      products.push(...(part.output.products as ProductCard[]));
    }
  }

  // A single turn can surface the same product via both the tool output and
  // the data-products stream part — dedupe within the message itself so one
  // reply never shows the same card twice.
  const seen = new Set<number>();
  return products.filter((product) => {
    if (seen.has(product.id)) {
      return false;
    }
    seen.add(product.id);
    return true;
  });
}

/**
 * All products the assistant has surfaced across the whole conversation so
 * far, deduped by id — used by the desktop 3-column layout's right panel
 * (see HeroChat.tsx), which shows recommendations cumulatively rather than
 * only the latest turn's results. Newest mention wins position (most recent
 * search results float to the top), which matters when the same product
 * comes up again later in the conversation.
 */
export function getAllProductsFromMessages(messages: ChatUIMessage[]): ProductCard[] {
  const byId = new Map<number, ProductCard>();

  for (const message of messages) {
    for (const product of getProductsFromMessage(message)) {
      byId.delete(product.id);
      byId.set(product.id, product);
    }
  }

  return [...byId.values()].reverse();
}
