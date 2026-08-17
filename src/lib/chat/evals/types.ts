import type { SearchProductsParams } from "@/types/chat";

export type EvalVerdict = "PASS" | "FAIL" | "WARN";

export interface SearchCase {
  id: string;
  query: string;
  params: SearchProductsParams;
  expect: {
    kind:
      | "contains_product_id"
      | "excludes_product_id"
      | "out_of_catalog"
      | "non_empty"
      | "empty_or_out";
    productId?: number;
  };
  notes?: string;
}

export interface ChatCase {
  id: string;
  query: string;
  expect: {
    kind:
      | "mentions_price_near"
      | "out_of_catalog_handoff"
      | "store_phone"
      | "store_address"
      | "store_hours"
      | "has_products"
      | "contains_product_id"
      | "no_invented_browse"
      | "asks_clarifying";
    productId?: number;
    price?: string;
  };
  notes?: string;
}

export interface CaseResult {
  layer: "A" | "B";
  id: string;
  query: string;
  verdict: EvalVerdict;
  detail: string;
}
