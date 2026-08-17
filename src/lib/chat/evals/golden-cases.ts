import type { CatalogProduct } from "@/types/catalog";

import type { ChatCase, SearchCase } from "@/lib/chat/evals/types";

function yearMidpoint(product: CatalogProduct): number | undefined {
  const ranges = Object.values(product.fitment.year_ranges);
  if (ranges.length === 0) {
    return undefined;
  }
  const range = ranges[0]!;
  return Math.floor((range.from + range.to) / 2);
}

function firstYearRange(product: CatalogProduct): { from: number; to: number } | null {
  const ranges = Object.values(product.fitment.year_ranges);
  return ranges[0] ?? null;
}

/** Catalog-grounded Layer A golden cases (search / scope). */
export function buildGoldenSearchCases(products: CatalogProduct[]): SearchCase[] {
  const cases: SearchCase[] = [];

  const withSku = products.filter((product) => product.sku.trim().length > 0).slice(0, 20);
  for (const product of withSku) {
    cases.push({
      id: `sku-${product.id}`,
      query: `SKU ${product.sku}`,
      params: { part_number: product.sku },
      expect: { kind: "contains_product_id", productId: product.id },
      notes: product.title,
    });
  }

  const withEngine = products.filter(
    (product) => product.fitment.engine_codes.length > 0 && product.fitment_expected,
  );
  const seenEngines = new Set<string>();
  for (const product of withEngine) {
    const engine = product.fitment.engine_codes[0]!;
    const make = product.fitment.makes[0];
    const model = product.fitment.models[0];
    const key = `${engine}|${make}|${model}`;
    if (seenEngines.has(key) || seenEngines.size >= 18) {
      continue;
    }
    seenEngines.add(key);
    const year = yearMidpoint(product);
    cases.push({
      id: `veh-${product.id}`,
      query: [make, model, engine, year, "injectors"].filter(Boolean).join(" "),
      params: {
        make,
        model,
        engine_code: engine,
        year,
        keyword: "injector",
      },
      expect: { kind: "contains_product_id", productId: product.id },
      notes: `Should surface ${product.title}`,
    });
  }

  // Year boundary: in-range should hit; clearly outside should exclude that product.
  const withYears = products.find(
    (product) =>
      product.fitment_expected &&
      product.fitment.makes[0] &&
      product.fitment.models[0] &&
      product.fitment.engine_codes[0] &&
      Object.keys(product.fitment.year_ranges).length > 0,
  );
  if (withYears) {
    const range = firstYearRange(withYears)!;
    const make = withYears.fitment.makes[0]!;
    const model = withYears.fitment.models[0]!;
    const engine = withYears.fitment.engine_codes[0]!;
    cases.push({
      id: `year-in-${withYears.id}`,
      query: `${make} ${model} ${engine} ${range.from}`,
      params: { make, model, engine_code: engine, year: range.from },
      expect: { kind: "contains_product_id", productId: withYears.id },
      notes: `Year ${range.from} is start of range ${range.from}-${range.to}`,
    });
    cases.push({
      id: `year-out-${withYears.id}`,
      query: `${make} ${model} ${engine} ${range.from - 5}`,
      params: { make, model, engine_code: engine, year: range.from - 5 },
      expect: { kind: "excludes_product_id", productId: withYears.id },
      notes: `Year ${range.from - 5} is outside ${range.from}-${range.to} (may FAIL if keyword fallback ignores year)`,
    });
  }

  const hardQueries: Array<{ id: string; query: string; params: SearchCase["params"] }> = [
    { id: "hard-4jj1-30", query: "4JJ1 +30 injectors pre DPF", params: { keyword: "4JJ1 +30" } },
    { id: "hard-1kd", query: "1KD Hilux injectors", params: { engine_code: "1KD", keyword: "injector" } },
    { id: "hard-zd30", query: "ZD30CRD injector bundle", params: { keyword: "ZD30CRD injector" } },
    { id: "hard-bt50", query: "Mazda BT-50 injector bundle", params: { keyword: "BT-50 injector" } },
    { id: "hard-scv-4jj1", query: "Isuzu 4JJ1 SCV", params: { keyword: "4JJ1 SCV" } },
    { id: "hard-hpfp", query: "Ford Ranger HPFP", params: { keyword: "HPFP Ranger" } },
    {
      id: "hard-scv-full",
      query: "suction control valve 4JJ1",
      params: { keyword: "suction control valve 4JJ1" },
    },
    { id: "hard-1vd-scv", query: "1VD SCV Land Cruiser", params: { keyword: "1VD SCV" } },
    { id: "hard-pre-dpf", query: "pre DPF injectors 4JJ1", params: { keyword: "pre DPF 4JJ1" } },
  ];
  for (const entry of hardQueries) {
    cases.push({
      id: entry.id,
      query: entry.query,
      params: entry.params,
      expect: { kind: "non_empty" },
    });
  }

  const negatives = [
    "Honda Civic brake pads",
    "Toyota Corolla spark plugs",
    "Mazda 3 clutch kit",
    "Ford Focus oil filter",
    "wiper blades for Hilux",
    "BMW 320d suspension",
    "Hyundai i30 alternator",
    "Subaru Forester clutch",
  ];
  negatives.forEach((query, index) => {
    cases.push({
      id: `oos-${index + 1}`,
      query,
      params: { keyword: query },
      expect: { kind: "out_of_catalog" },
    });
  });

  return cases;
}

/** Layer B live-chat golden cases. */
export function buildGoldenChatCases(products: CatalogProduct[]): ChatCase[] {
  const cases: ChatCase[] = [
    {
      id: "chat-store-phone",
      query: "What is your phone number?",
      expect: { kind: "store_phone" },
    },
    {
      id: "chat-store-address",
      query: "Where are you located / what's your address?",
      expect: { kind: "store_address" },
    },
    {
      id: "chat-store-hours",
      query: "What are your opening hours?",
      expect: { kind: "store_hours" },
    },
    {
      id: "chat-oos-civic",
      query: "Do you have brake pads for a Honda Civic?",
      expect: { kind: "out_of_catalog_handoff" },
    },
    {
      id: "chat-oos-corolla",
      query: "spark plugs for Toyota Corolla",
      expect: { kind: "out_of_catalog_handoff" },
    },
    {
      id: "chat-4jj1",
      query: "4JJ1 injectors for a 2010 Isuzu D-Max",
      expect: { kind: "has_products" },
    },
    {
      id: "chat-1kd",
      query: "1KD injectors for Toyota Hilux",
      expect: { kind: "has_products" },
    },
    {
      id: "chat-zd30",
      query: "ZD30CRD injector bundle",
      expect: { kind: "has_products" },
    },
    {
      id: "chat-scv",
      query: "Do you have a 4JJ1 SCV?",
      expect: { kind: "has_products" },
      notes: "Acronym should resolve via synonym expansion + tool search",
    },
    {
      id: "chat-hpfp",
      query: "Ford Ranger HPFP",
      expect: { kind: "has_products" },
    },
    {
      id: "chat-vague",
      query: "I need injectors for my ute",
      expect: { kind: "asks_clarifying" },
      notes: "Should ask make/model/year — not invent prices",
    },
    {
      id: "chat-compare-start",
      query: "I want to compare parts",
      expect: { kind: "asks_clarifying" },
    },
  ];

  const priced = products.find((product) => product.sku && Number(product.price) > 0);
  if (priced) {
    cases.push({
      id: `chat-sku-${priced.id}`,
      query: `Do you have part number ${priced.sku}? What is the price?`,
      expect: {
        kind: "mentions_price_near",
        productId: priced.id,
        price: priced.price,
      },
      notes: priced.title,
    });
  }

  const plus30 = products.find(
    (product) => /4jj1/i.test(product.title) && /\+30|pre.?dpf/i.test(product.title),
  );
  if (plus30) {
    // Stage2 has no product literally named "+30 injectors". Prefer the real
    // Pre-DPF catalog title so this case tests retrieval/pricing, not a missing SKU.
    cases.push({
      id: "chat-4jj1-pre-dpf-price",
      query: `What is the price of the ${plus30.title}?`,
      expect: {
        kind: "mentions_price_near",
        productId: plus30.id,
        price: plus30.sale_price || plus30.price,
      },
      notes: plus30.title,
    });
  }

  const scv = products.find(
    (product) => /suction control valve/i.test(product.title) && /4jj1/i.test(product.title),
  );
  if (scv) {
    cases.push({
      id: "chat-scv-id",
      query: "Isuzu 4JJ1 SCV",
      expect: { kind: "contains_product_id", productId: scv.id },
      notes: scv.title,
    });
  }

  return cases;
}
