import { searchProducts, toProductCard } from "@/lib/search/search-products";
import type { CatalogProduct } from "@/types/catalog";
import type { CompareProductsResult, CompareProductRef, ProductCard } from "@/types/chat";

const MIN_COMPARE = 2;
const MAX_COMPARE = 3;

function normalizeSku(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "");
}

function findById(products: CatalogProduct[], id: number): CatalogProduct | null {
  return products.find((product) => product.id === id) ?? null;
}

function findBySku(products: CatalogProduct[], sku: string): CatalogProduct | null {
  const normalized = normalizeSku(sku);
  if (!normalized) {
    return null;
  }
  return (
    products.find((product) => product.sku && normalizeSku(product.sku) === normalized) ?? null
  );
}

function resolveOne(
  catalog: CatalogProduct[],
  ref: CompareProductRef,
): { product: CatalogProduct | null; label: string; ambiguous: boolean } {
  const label =
    ref.title_or_query?.trim() ||
    ref.sku?.trim() ||
    (ref.product_id != null ? `product #${ref.product_id}` : "unknown");

  if (ref.product_id != null) {
    const byId = findById(catalog, ref.product_id);
    if (byId) {
      return { product: byId, label, ambiguous: false };
    }
  }

  if (ref.sku?.trim()) {
    const bySku = findBySku(catalog, ref.sku);
    if (bySku) {
      return { product: bySku, label, ambiguous: false };
    }
  }

  const query = ref.title_or_query?.trim() || ref.sku?.trim();
  if (!query) {
    return { product: null, label, ambiguous: false };
  }

  const partResult = searchProducts(catalog, { part_number: query }, 3);
  if (partResult.products.length === 1) {
    const match = findById(catalog, partResult.products[0]!.id);
    return { product: match, label, ambiguous: false };
  }
  if (partResult.products.length > 1) {
    return { product: null, label, ambiguous: true };
  }

  const keywordResult = searchProducts(catalog, { keyword: query }, 3);
  if (keywordResult.products.length === 1) {
    const match = findById(catalog, keywordResult.products[0]!.id);
    return { product: match, label, ambiguous: false };
  }
  if (keywordResult.products.length > 1) {
    return { product: null, label, ambiguous: true };
  }

  return { product: null, label, ambiguous: false };
}

/**
 * Resolve 2–3 product refs from the catalog snapshot for side-by-side compare.
 * Prefers explicit product_id / sku, then a single clear search match.
 */
export function compareProducts(
  catalog: CatalogProduct[],
  items: CompareProductRef[],
): CompareProductsResult {
  const limited = items.slice(0, MAX_COMPARE);
  if (limited.length < MIN_COMPARE) {
    return {
      ok: false,
      products: [],
      unresolved: [],
      ambiguous: [],
      error: `Provide between ${MIN_COMPARE} and ${MAX_COMPARE} products to compare.`,
    };
  }

  const products: ProductCard[] = [];
  const unresolved: string[] = [];
  const ambiguous: string[] = [];
  const seenIds = new Set<number>();

  for (const ref of limited) {
    const resolved = resolveOne(catalog, ref);
    if (resolved.ambiguous) {
      ambiguous.push(resolved.label);
      continue;
    }
    if (!resolved.product) {
      unresolved.push(resolved.label);
      continue;
    }
    if (seenIds.has(resolved.product.id)) {
      continue;
    }
    seenIds.add(resolved.product.id);
    products.push(toProductCard(resolved.product));
  }

  if (products.length < MIN_COMPARE) {
    return {
      ok: false,
      products,
      unresolved,
      ambiguous,
      error:
        products.length === 0
          ? "Could not find those products to compare. Ask for clearer names or SKUs."
          : "Need at least two distinct matching products to compare. Ask which ones to use.",
    };
  }

  return {
    ok: true,
    products,
    unresolved,
    ambiguous,
    error: null,
  };
}
