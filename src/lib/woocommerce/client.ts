import type { WooCommerceProduct } from "@/types/catalog";

// Staging uses _product_fitment; production may use mobex_child_fitment_info.
const FITMENT_META_KEYS = ["_product_fitment", "mobex_child_fitment_info"] as const;
const PER_PAGE = 100;

export interface RawWooProduct {
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
}

function getWooConfig(): { baseUrl: string; consumerKey: string; consumerSecret: string } {
  const baseUrl = process.env.WOOCOMMERCE_URL?.replace(/\/$/, "");
  const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY;
  const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET;

  if (!baseUrl || !consumerKey || !consumerSecret) {
    throw new Error(
      "WOOCOMMERCE_URL, WOOCOMMERCE_CONSUMER_KEY, and WOOCOMMERCE_CONSUMER_SECRET are required",
    );
  }

  return { baseUrl, consumerKey, consumerSecret };
}

function appendWooAuthParams(
  url: URL,
  consumerKey: string,
  consumerSecret: string,
): void {
  // Query-string auth works when hosting strips the Authorization header.
  url.searchParams.set("consumer_key", consumerKey);
  url.searchParams.set("consumer_secret", consumerSecret);
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStockStatus(
  status: string,
): "instock" | "outofstock" | "onbackorder" {
  if (status === "instock" || status === "outofstock" || status === "onbackorder") {
    return status;
  }
  return "outofstock";
}

function readFitmentFromMeta(
  metaData: WooCommerceProduct["meta_data"],
  key: string,
): string | null {
  const metaEntry = metaData?.find((entry) => entry.key === key);
  if (metaEntry && typeof metaEntry.value === "string" && metaEntry.value.trim()) {
    return metaEntry.value.trim();
  }
  return null;
}

function readFitmentFromTopLevel(product: WooCommerceProduct, key: string): string | null {
  const value = product[key as keyof WooCommerceProduct];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

function extractFitmentRaw(product: WooCommerceProduct): string {
  for (const key of FITMENT_META_KEYS) {
    const topLevel = readFitmentFromTopLevel(product, key);
    if (topLevel) {
      return topLevel;
    }

    const fromMeta = readFitmentFromMeta(product.meta_data, key);
    if (fromMeta) {
      return fromMeta;
    }
  }

  return "";
}

function mapWooProduct(product: WooCommerceProduct): RawWooProduct {
  const price = product.price || product.regular_price || "0";
  const salePrice = product.sale_price?.trim() ? product.sale_price : null;

  return {
    id: product.id,
    sku: product.sku?.trim() ?? "",
    title: product.name?.trim() ?? "",
    price,
    sale_price: salePrice,
    stock_status: normalizeStockStatus(product.stock_status),
    categories: product.categories?.map((category) => category.name) ?? [],
    permalink: product.permalink,
    image_url: product.images?.[0]?.src ?? null,
    short_description: stripHtml(product.short_description ?? ""),
    fitment_raw: extractFitmentRaw(product),
  };
}

async function fetchProductsPage(
  page: number,
  baseUrl: string,
  consumerKey: string,
  consumerSecret: string,
): Promise<WooCommerceProduct[]> {
  const url = new URL(`${baseUrl}/wp-json/wc/v3/products`);
  url.searchParams.set("status", "publish");
  url.searchParams.set("per_page", String(PER_PAGE));
  url.searchParams.set("page", String(page));
  appendWooAuthParams(url, consumerKey, consumerSecret);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WooCommerce API error ${response.status} on page ${page}: ${body}`);
  }

  return (await response.json()) as WooCommerceProduct[];
}

export async function fetchPublishedProducts(): Promise<RawWooProduct[]> {
  const { baseUrl, consumerKey, consumerSecret } = getWooConfig();
  const allProducts: RawWooProduct[] = [];
  let page = 1;

  while (true) {
    const pageProducts = await fetchProductsPage(page, baseUrl, consumerKey, consumerSecret);

    if (pageProducts.length === 0) {
      break;
    }

    for (const product of pageProducts) {
      if (product.status !== "publish") {
        continue;
      }
      allProducts.push(mapWooProduct(product));
    }

    if (pageProducts.length < PER_PAGE) {
      break;
    }

    page += 1;
  }

  return allProducts;
}
