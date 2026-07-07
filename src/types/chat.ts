import type { UIMessage } from "ai";

export interface ProductCard {
  id: number;
  title: string;
  price: string;
  sale_price: string | null;
  stock_status: string;
  image_url: string | null;
  permalink: string;
  sku: string;
  fitment_expected: boolean;
  fitment_summary: string | null;
}

export type SearchMatchType = "part_number" | "structured" | "keyword" | "none";

export interface SearchProductsParams {
  part_number?: string;
  make?: string;
  model?: string;
  engine_code?: string;
  year?: number;
  keyword?: string;
}

export interface CatalogSearchResult {
  match_type: SearchMatchType;
  result_count: number;
  products: ProductCard[];
}

export interface SearchProductsToolResult extends CatalogSearchResult {
  out_of_catalog_scope: boolean;
  out_of_scope_reason: string | null;
  clarifying_questions_allowed: boolean;
  catalog_scope_summary: string;
}

export interface ConversationSearchCall {
  args: SearchProductsParams;
  match_type: SearchMatchType;
  result_count: number;
}

export interface ConversationLogEntry {
  session_id: string;
  timestamp: string;
  user_message_preview: string;
  search_calls: ConversationSearchCall[];
  lookup_hits: number;
  lookup_misses: number;
  assistant_text_preview: string;
}

export type ChatUIMessage = UIMessage<
  unknown,
  {
    products: ProductCard[];
  }
>;
