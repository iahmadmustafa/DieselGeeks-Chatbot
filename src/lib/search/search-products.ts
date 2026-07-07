import { stripHtml } from "@/lib/text/strip-html";
import type { CatalogProduct, NormalizedFitment } from "@/types/catalog";
import type {
  CatalogSearchResult,
  ProductCard,
  SearchMatchType,
  SearchProductsParams,
} from "@/types/chat";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

function normalizePartNumber(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "");
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeDisplayText(value: string | null | undefined, maxLength = 240): string | null {
  if (!value) {
    return null;
  }

  const cleaned = stripHtml(value)
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return null;
  }

  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}…` : cleaned;
}

function isUsableYearRangeKey(key: string): boolean {
  return !/[<>]/.test(key) && key.trim().length > 0 && key.length <= 80;
}

export function buildFitmentSummary(product: CatalogProduct): string | null {
  if (!product.fitment_expected) {
    return null;
  }

  const { fitment } = product;
  const parts: string[] = [];

  if (fitment.makes.length > 0) {
    parts.push(`Makes: ${fitment.makes.join(", ")}`);
  }
  if (fitment.models.length > 0) {
    parts.push(`Models: ${fitment.models.join(", ")}`);
  }
  if (fitment.engine_codes.length > 0) {
    parts.push(`Engine: ${fitment.engine_codes.join(", ")}`);
  }

  const yearEntries = Object.entries(fitment.year_ranges).filter(([model]) =>
    isUsableYearRangeKey(model),
  );
  if (yearEntries.length > 0) {
    const years = yearEntries
      .map(([model, range]) => `${model}: ${range.from}–${range.to}`)
      .join("; ");
    parts.push(`Years: ${years}`);
  }

  if (parts.length > 0) {
    return sanitizeDisplayText(parts.join(". "));
  }

  return sanitizeDisplayText(product.fitment_raw, 200);
}

export function toProductCard(product: CatalogProduct): ProductCard {
  return {
    id: product.id,
    title: sanitizeDisplayText(product.title, 300) ?? product.title,
    price: product.price,
    sale_price: product.sale_price,
    stock_status: product.stock_status,
    image_url: product.image_url,
    permalink: product.permalink,
    sku: product.sku,
    fitment_expected: product.fitment_expected,
    fitment_summary: buildFitmentSummary(product),
  };
}

function matchesPartNumber(product: CatalogProduct, partNumber: string): boolean {
  const query = partNumber.trim();
  if (!query) {
    return false;
  }

  const normalizedQuery = normalizePartNumber(query);
  if (product.sku && normalizePartNumber(product.sku) === normalizedQuery) {
    return true;
  }

  const flexiblePattern = escapeRegex(query).replace(/\s+/g, "[\\s-]*");
  const pattern = new RegExp(flexiblePattern, "i");
  return pattern.test(product.sku) || pattern.test(product.title);
}

function tokenMatches(candidate: string, query: string): boolean {
  const normalizedCandidate = normalizeToken(candidate);
  const normalizedQuery = normalizeToken(query);
  if (!normalizedCandidate || !normalizedQuery) {
    return false;
  }

  return (
    normalizedCandidate === normalizedQuery ||
    normalizedCandidate.includes(normalizedQuery) ||
    normalizedQuery.includes(normalizedCandidate)
  );
}

function matchesMake(fitment: NormalizedFitment, make: string, raw: string): boolean {
  if (fitment.makes.some((entry) => tokenMatches(entry, make))) {
    return true;
  }

  return normalizeToken(raw).includes(normalizeToken(make));
}

function matchesModel(fitment: NormalizedFitment, model: string, raw: string): boolean {
  const modelCandidates = [...fitment.models, ...Object.keys(fitment.year_ranges)];
  if (modelCandidates.some((entry) => tokenMatches(entry, model))) {
    return true;
  }

  return normalizeToken(raw).includes(normalizeToken(model));
}

function matchesEngine(fitment: NormalizedFitment, engineCode: string, raw: string): boolean {
  if (fitment.engine_codes.some((entry) => tokenMatches(entry, engineCode))) {
    return true;
  }

  return normalizeToken(raw).includes(normalizeToken(engineCode));
}

function matchesYear(fitment: NormalizedFitment, year: number, raw: string): boolean {
  for (const range of Object.values(fitment.year_ranges)) {
    if (year >= range.from && year <= range.to) {
      return true;
    }
  }

  return new RegExp(`\\b${year}\\b`).test(raw);
}

function matchesStructuredFilters(
  product: CatalogProduct,
  params: SearchProductsParams,
): boolean {
  if (!product.fitment_expected) {
    return false;
  }

  const raw = stripHtml(product.fitment_raw);
  const { fitment } = product;

  if (params.make && !matchesMake(fitment, params.make, raw)) {
    return false;
  }
  if (params.model && !matchesModel(fitment, params.model, raw)) {
    return false;
  }
  if (params.engine_code && !matchesEngine(fitment, params.engine_code, raw)) {
    return false;
  }
  if (params.year != null && !matchesYear(fitment, params.year, raw)) {
    return false;
  }

  return Boolean(params.make || params.model || params.engine_code || params.year != null);
}

function buildSearchCorpus(product: CatalogProduct): string {
  const title = product.title;
  const description = stripHtml(product.short_description);

  if (!product.fitment_expected) {
    return [title, description, product.categories.join(" ")].join(" ").trim();
  }

  return [title, description, stripHtml(product.fitment_raw)].join(" ").trim();
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);
}

function keywordScore(corpus: string, query: string): number {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return 0;
  }

  const corpusLower = corpus.toLowerCase();
  let matched = 0;

  for (const token of tokens) {
    if (corpusLower.includes(token)) {
      matched += 1;
    }
  }

  if (matched === 0) {
    return 0;
  }

  if (tokens.length > 1 && matched < tokens.length) {
    return 0;
  }

  const normalizedQuery = query.trim().toLowerCase();
  let score = matched / tokens.length;
  if (normalizedQuery.length >= 4 && corpusLower.includes(normalizedQuery)) {
    score += 1;
  }

  return score;
}

function buildKeywordQuery(params: SearchProductsParams): string {
  return [params.keyword, params.make, params.model, params.engine_code]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .trim();
}

function rankKeywordMatches(
  products: CatalogProduct[],
  query: string,
): CatalogProduct[] {
  return products
    .map((product) => ({
      product,
      score: keywordScore(buildSearchCorpus(product), query),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.product);
}

function finalizeResult(
  products: CatalogProduct[],
  matchType: SearchMatchType,
  limit: number,
): CatalogSearchResult {
  const cards = products.slice(0, limit).map(toProductCard);
  return {
    match_type: matchType,
    result_count: cards.length,
    products: cards,
  };
}

export function searchProducts(
  products: CatalogProduct[],
  params: SearchProductsParams,
  limit = DEFAULT_LIMIT,
): CatalogSearchResult {
  const effectiveLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);

  if (params.part_number?.trim()) {
    const partMatches = products.filter((product) =>
      matchesPartNumber(product, params.part_number!),
    );
    if (partMatches.length > 0) {
      return finalizeResult(partMatches, "part_number", effectiveLimit);
    }
  }

  const hasStructuredFilters = Boolean(
    params.make || params.model || params.engine_code || params.year != null,
  );

  if (hasStructuredFilters) {
    const structuredMatches = products.filter((product) =>
      matchesStructuredFilters(product, params),
    );
    if (structuredMatches.length > 0) {
      return finalizeResult(structuredMatches, "structured", effectiveLimit);
    }
  }

  const keywordQuery = buildKeywordQuery(params);
  if (keywordQuery) {
    const keywordMatches = rankKeywordMatches(products, keywordQuery);
    if (keywordMatches.length > 0) {
      return finalizeResult(keywordMatches, "keyword", effectiveLimit);
    }
  }

  return {
    match_type: "none",
    result_count: 0,
    products: [],
  };
}
