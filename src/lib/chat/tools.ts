import { tool, type ToolSet } from "ai";
import { z } from "zod";

import { enrichSearchResult, extractCatalogScope } from "@/lib/catalog/scope";
import { searchProducts } from "@/lib/search/search-products";
import type { ProductSnapshot } from "@/types/catalog";
import type {
  ConversationSearchCall,
  ProductCard,
  SearchProductsParams,
  SearchProductsToolResult,
} from "@/types/chat";

export const searchProductsInputSchema = z.object({
  part_number: z
    .string()
    .optional()
    .describe("Exact SKU or OEM part number when the customer provides one."),
  make: z.string().optional().describe("Vehicle make, e.g. Toyota, Isuzu, Ford."),
  model: z.string().optional().describe("Vehicle model, e.g. D-Max, Hilux, Ranger."),
  engine_code: z
    .string()
    .optional()
    .describe("Engine code, e.g. 4JJ1, 1KD, ZD30."),
  year: z
    .number()
    .int()
    .optional()
    .describe("Build year as a 4-digit number, e.g. 2012."),
  keyword: z
    .string()
    .optional()
    .describe("Free-text search across titles, descriptions, and fitment text."),
});

export interface ChatToolCallbacks {
  onSearchComplete: (result: SearchProductsToolResult, args: SearchProductsParams) => void;
}

export function createChatTools(
  snapshot: ProductSnapshot,
  callbacks: ChatToolCallbacks,
): ToolSet {
  const catalogScope = extractCatalogScope(snapshot.products);

  return {
    search_products: tool({
      description:
        "Search the Diesel Geeks product catalog. Use part_number for SKU/OEM lookups, structured vehicle filters for fitment queries, or keyword for broad searches. Returns real prices, stock, permalinks, fitment summaries, and out_of_catalog_scope signals when the query is outside what the store carries.",
      inputSchema: searchProductsInputSchema,
      execute: async (input) => {
        const result = searchProducts(snapshot.products, input);
        const enriched = enrichSearchResult(result, input, catalogScope);
        callbacks.onSearchComplete(enriched, input);
        return enriched;
      },
    }),
  };
}

export function mergeProductCards(existing: ProductCard[], incoming: ProductCard[]): ProductCard[] {
  const merged = [...existing];
  for (const product of incoming) {
    if (!merged.some((entry) => entry.id === product.id)) {
      merged.push(product);
    }
  }
  return merged;
}

export function collectSearchCalls(
  existing: ConversationSearchCall[],
  result: SearchProductsToolResult,
  args: SearchProductsParams,
): ConversationSearchCall[] {
  return [
    ...existing,
    {
      args,
      match_type: result.match_type,
      result_count: result.result_count,
    },
  ];
}
