import { createHash } from "node:crypto";

import { classifyFitmentAttention, isFitmentExpected } from "@/lib/fitment/fitment-expected";
import { parseFitmentWithLlm } from "@/lib/fitment/normalize";
import {
  isDeterministicParseSufficient,
  parseFitmentDeterministic,
} from "@/lib/fitment/parser";
import { readEnv } from "@/lib/env/read-env";
import {
  getFitmentParseCache,
  getSnapshot,
  setFitmentParseCache,
  setFitmentReviewList,
  setSnapshot,
} from "@/lib/redis/snapshot";
import { mapWithConcurrency } from "@/lib/sync/concurrency";
import type { CatalogProduct, FitmentParseResult, FitmentReviewItem, ProductSnapshot, SyncResult } from "@/types/catalog";
import { fetchPublishedProducts, type RawWooProduct } from "@/lib/woocommerce/client";

function snapshotVersion(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function getLlmConcurrency(): number {
  const configured = Number(readEnv("FITMENT_LLM_CONCURRENCY") ?? "8");
  if (Number.isNaN(configured) || configured < 1) {
    return 8;
  }
  return Math.min(configured, 20);
}

interface ProductParseJob {
  wooProduct: RawWooProduct;
  contentHash: string;
  fitmentRaw: string;
  cached: FitmentParseResult | null;
  deterministic: FitmentParseResult;
}

function buildCatalogProduct(
  wooProduct: RawWooProduct,
  parseResult: FitmentParseResult,
  fitmentRaw: string,
): CatalogProduct {
  const fitmentExpected = isFitmentExpected(wooProduct.title, wooProduct.categories);

  return {
    id: wooProduct.id,
    sku: wooProduct.sku,
    title: wooProduct.title,
    price: wooProduct.price,
    sale_price: wooProduct.sale_price,
    stock_status: wooProduct.stock_status,
    categories: wooProduct.categories,
    permalink: wooProduct.permalink,
    image_url: wooProduct.image_url,
    short_description: wooProduct.short_description,
    fitment_raw: fitmentRaw,
    fitment: parseResult.fitment,
    fitment_parse_method: parseResult.method,
    fitment_parse_error: parseResult.parseError,
    fitment_expected: fitmentExpected,
  };
}

export async function runProductSync(): Promise<SyncResult> {
  const syncStartedAt = Date.now();
  const wooProducts = await fetchPublishedProducts();
  const syncedAt = new Date().toISOString();
  const version = snapshotVersion();
  const llmConcurrency = getLlmConcurrency();

  const jobs: ProductParseJob[] = [];
  const llmJobs: ProductParseJob[] = [];

  for (const wooProduct of wooProducts) {
    const fitmentRaw = wooProduct.fitment_raw;
    const contentHash = createHash("sha256").update(fitmentRaw).digest("hex");
    const cached = await getFitmentParseCache(contentHash);
    const deterministic = parseFitmentDeterministic(fitmentRaw);

    const job: ProductParseJob = {
      wooProduct,
      contentHash,
      fitmentRaw,
      cached,
      deterministic,
    };

    jobs.push(job);

    if (!cached && !isDeterministicParseSufficient(deterministic)) {
      llmJobs.push(job);
    }
  }

  console.log("[sync] fitment parse plan", {
    product_count: jobs.length,
    cache_hits: jobs.filter((job) => job.cached).length,
    deterministic_only: jobs.filter(
      (job) => !job.cached && isDeterministicParseSufficient(job.deterministic),
    ).length,
    llm_fallback_queued: llmJobs.length,
    llm_concurrency: llmConcurrency,
  });

  const parseResults = new Map<string, FitmentParseResult>();

  for (const job of jobs) {
    if (job.cached) {
      parseResults.set(job.contentHash, job.cached);
    } else if (isDeterministicParseSufficient(job.deterministic)) {
      parseResults.set(job.contentHash, job.deterministic);
      await setFitmentParseCache(job.contentHash, job.deterministic);
    }
  }

  if (llmJobs.length > 0) {
    const llmStartedAt = Date.now();

    await mapWithConcurrency(llmJobs, llmConcurrency, async (job) => {
      const parseResult = await parseFitmentWithLlm(job.fitmentRaw);
      parseResults.set(job.contentHash, parseResult);
      await setFitmentParseCache(job.contentHash, parseResult);
    });

    console.log("[sync] llm fallback batch complete", {
      llm_jobs: llmJobs.length,
      duration_ms: Date.now() - llmStartedAt,
    });
  }

  const products: CatalogProduct[] = [];
  const reviewItems: FitmentReviewItem[] = [];
  let llmFallbackCount = 0;

  for (const job of jobs) {
    const parseResult = parseResults.get(job.contentHash);
    if (!parseResult) {
      throw new Error(`Missing parse result for product ${job.wooProduct.id}`);
    }

    if (parseResult.method === "llm") {
      llmFallbackCount += 1;
    }

    if (parseResult.parseError) {
      const catalogProduct = buildCatalogProduct(job.wooProduct, parseResult, job.fitmentRaw);

      if (catalogProduct.fitment_expected) {
        reviewItems.push({
          product_id: job.wooProduct.id,
          sku: job.wooProduct.sku,
          title: job.wooProduct.title,
          fitment_raw: job.fitmentRaw,
          parse_error: parseResult.parseError,
          parse_method: parseResult.method,
          flagged_at: syncedAt,
          fitment_expected: true,
          action_needed: classifyFitmentAttention(job.fitmentRaw, parseResult.parseError),
        });
      }
    }

    products.push(buildCatalogProduct(job.wooProduct, parseResult, job.fitmentRaw));
  }

  const snapshot: ProductSnapshot = {
    version,
    synced_at: syncedAt,
    product_count: products.length,
    products,
  };

  await setSnapshot(snapshot);
  await setFitmentReviewList(reviewItems);

  console.log("[sync] complete", {
    product_count: products.length,
    parse_failures: reviewItems.length,
    llm_fallback_count: llmFallbackCount,
    duration_ms: Date.now() - syncStartedAt,
  });

  return {
    version,
    synced_at: syncedAt,
    product_count: products.length,
    parse_failures: reviewItems.length,
    llm_fallback_count: llmFallbackCount,
    review_items: reviewItems,
  };
}

export async function loadCurrentSnapshot(): Promise<ProductSnapshot | null> {
  return getSnapshot();
}
