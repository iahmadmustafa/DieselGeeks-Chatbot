export interface YearRange {
  from: number;
  to: number;
}

export interface NormalizedFitment {
  makes: string[];
  models: string[];
  engine_codes: string[];
  fuel_type: string | null;
  fuel_system: string | null;
  year_ranges: Record<string, YearRange>;
  notes: string | null;
}

export type FitmentParseMethod = "deterministic" | "llm" | "empty";

export interface FitmentParseResult {
  fitment: NormalizedFitment;
  method: FitmentParseMethod;
  parseError: string | null;
}

export interface CatalogProduct {
  id: number;
  sku: string;
  title: string;
  price: string;
  sale_price: string | null;
  stock_status: "instock" | "outofstock" | "onbackorder";
  categories: string[];
  permalink: string;
  image_url: string | null;
  short_description: string;
  fitment_raw: string;
  fitment: NormalizedFitment;
  fitment_parse_method: FitmentParseMethod;
  fitment_parse_error: string | null;
  fitment_expected: boolean;
}

export interface ProductSnapshot {
  version: string;
  synced_at: string;
  product_count: number;
  products: CatalogProduct[];
}

export interface FitmentReviewItem {
  product_id: number;
  sku: string;
  title: string;
  fitment_raw: string;
  parse_error: string;
  parse_method: FitmentParseMethod;
  flagged_at: string;
  fitment_expected: boolean;
  action_needed: string;
}

export interface SyncResult {
  version: string;
  synced_at: string;
  product_count: number;
  parse_failures: number;
  llm_fallback_count: number;
  review_items: FitmentReviewItem[];
}

export interface WooCommerceProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_status: string;
  short_description: string;
  status: string;
  categories: Array<{ id: number; name: string; slug: string }>;
  images: Array<{ id: number; src: string; alt: string }>;
  meta_data?: Array<{ id: number; key: string; value: unknown }>;
  _product_fitment?: string;
  mobex_child_fitment_info?: string;
}
