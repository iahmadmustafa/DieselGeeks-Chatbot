import { tool, type ToolSet } from "ai";
import { z } from "zod";

import type { WpIdentity } from "@/lib/auth/wp-identity";
import { compareProducts } from "@/lib/chat/compare-products";
import { enrichSearchResult, extractCatalogScope } from "@/lib/catalog/scope";
import { searchProducts } from "@/lib/search/search-products";
import { listMyOrders, lookupOrder } from "@/lib/woocommerce/orders";
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

export interface CreateChatToolsOptions {
  identity?: WpIdentity | null;
}

export function createChatTools(
  snapshot: ProductSnapshot,
  callbacks: ChatToolCallbacks,
  options: CreateChatToolsOptions = {},
): ToolSet {
  const catalogScope = extractCatalogScope(snapshot.products);
  const identity = options.identity ?? null;

  return {
    list_catalog_makes: tool({
      description:
        "List distinct vehicle makes from parsed product fitment data in the catalog snapshot. Use when the customer asks what makes, brands, or vehicles the store covers (e.g. 'list all makes', 'what vehicles do you support'). Returns only makes from product.fitment.makes — not categories or general knowledge.",
      inputSchema: z.object({}),
      execute: async () => ({
        makes: catalogScope.makes,
        make_count: catalogScope.makes.length,
        data_source: "product.fitment.makes from catalog snapshot",
      }),
    }),
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
    lookup_order: tool({
      description:
        "Look up a WooCommerce order status by order number. Guests must provide the checkout email for THAT order. Signed-in customers may only look up orders on their own account — omit email or pass their account email; never pass a different person's email. Use for 'where is my order' / order status. Never invent status — only report tool results.",
      inputSchema: z.object({
        order_id: z
          .union([z.string(), z.number()])
          .describe("WooCommerce order number, e.g. 15956 or '#15956'."),
        email: z
          .string()
          .email()
          .optional()
          .describe(
            "Billing/checkout email. Required for guests. For signed-in users, only their own account email is allowed (or omit it).",
          ),
      }),
      execute: async (input) =>
        lookupOrder({
          orderId: input.order_id,
          email: input.email,
          identity,
        }),
    }),
    list_my_orders: tool({
      description:
        "List the signed-in customer's recent WooCommerce orders. Requires login. Use when they ask 'show my orders' or 'what have I ordered' without a specific order number. Guests should use lookup_order with order number + email instead.",
      inputSchema: z.object({
        limit: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe("How many recent orders to return (default 5, max 10)."),
      }),
      execute: async (input) =>
        listMyOrders({
          identity,
          limit: input.limit,
        }),
    }),
    compare_products: tool({
      description:
        "Build a side-by-side comparison of 2–3 catalog products. Use when the customer asks to compare parts (e.g. 'compare these two', 'compare A vs B'). Prefer product_id from earlier search_products results when available; otherwise sku or title_or_query. The UI renders the comparison table — do not paste a markdown table. If products are unclear, ask first instead of calling this tool.",
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              product_id: z
                .number()
                .int()
                .optional()
                .describe("WooCommerce product id from a prior search_products result."),
              sku: z.string().optional().describe("Exact SKU when known."),
              title_or_query: z
                .string()
                .optional()
                .describe("Product title fragment or search text when id/sku are unknown."),
            }),
          )
          .min(2)
          .max(3)
          .describe("Exactly 2 or 3 products to compare."),
      }),
      execute: async (input) => compareProducts(snapshot.products, input.items),
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
