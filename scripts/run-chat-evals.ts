/**
 * Catalog-grounded evals for Diesel Geeks chat (Layer A search + Layer B chat).
 * Does not change product/prompt code — report only.
 *
 * Usage:
 *   npx tsx scripts/run-chat-evals.ts
 *   npx tsx scripts/run-chat-evals.ts --chat   # also hit live /api/chat (costs OpenAI $)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { loadEnvLocal } from "../src/lib/env/load-env-local";
import { enrichSearchResult, extractCatalogScope } from "../src/lib/catalog/scope";
import { searchProducts } from "../src/lib/search/search-products";
import type { CatalogProduct, ProductSnapshot } from "../src/types/catalog";
import type { SearchProductsParams } from "../src/types/chat";

loadEnvLocal();

const CHAT_API = process.env.EVAL_CHAT_API_URL ?? "https://diesel-geeks-chatbot.vercel.app/api/chat";
const ORIGIN = process.env.EVAL_ORIGIN ?? "https://stage2.dieselgeeks.com.au";
const RUN_CHAT = process.argv.includes("--chat");

interface SearchCase {
  id: string;
  query: string;
  params: SearchProductsParams;
  expect: {
    kind: "contains_product_id" | "out_of_catalog" | "non_empty" | "empty_or_out";
    productId?: number;
  };
  notes?: string;
}

interface ChatCase {
  id: string;
  query: string;
  expect: {
    kind:
      | "mentions_price_near"
      | "out_of_catalog_handoff"
      | "store_phone"
      | "has_products"
      | "no_invented_browse";
    productId?: number;
    price?: string;
  };
  notes?: string;
}

interface CaseResult {
  layer: "A" | "B";
  id: string;
  query: string;
  verdict: "PASS" | "FAIL" | "WARN";
  detail: string;
}

function loadProducts(): CatalogProduct[] {
  const raw = JSON.parse(readFileSync(resolve("tmp/catalog-snapshot.json"), "utf8")) as {
    snapshot?: ProductSnapshot;
    products?: CatalogProduct[];
  };
  const products = raw.snapshot?.products ?? raw.products;
  if (!products?.length) {
    throw new Error("No products in tmp/catalog-snapshot.json — fetch /api/catalog first");
  }
  return products;
}

function yearFromProduct(product: CatalogProduct): number | undefined {
  const ranges = Object.values(product.fitment.year_ranges);
  if (ranges.length === 0) {
    return undefined;
  }
  const range = ranges[0]!;
  return Math.floor((range.from + range.to) / 2);
}

function buildSearchCases(products: CatalogProduct[]): SearchCase[] {
  const cases: SearchCase[] = [];
  const withSku = products.filter((p) => p.sku.trim().length > 0).slice(0, 12);
  for (const product of withSku) {
    cases.push({
      id: `sku-${product.id}`,
      query: `SKU ${product.sku}`,
      params: { part_number: product.sku },
      expect: { kind: "contains_product_id", productId: product.id },
      notes: product.title,
    });
  }

  const withEngine = products.filter((p) => p.fitment.engine_codes.length > 0 && p.fitment_expected);
  const seenEngines = new Set<string>();
  for (const product of withEngine) {
    const engine = product.fitment.engine_codes[0]!;
    const make = product.fitment.makes[0];
    const model = product.fitment.models[0];
    const key = `${engine}|${make}|${model}`;
    if (seenEngines.has(key) || seenEngines.size >= 15) {
      continue;
    }
    seenEngines.add(key);
    const year = yearFromProduct(product);
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

  // Known hard / brand queries from the live site positioning
  const famous = [
    { id: "hard-4jj1-30", params: { keyword: "4JJ1 +30" }, query: "4JJ1 +30 injectors pre DPF" },
    { id: "hard-1kd", params: { engine_code: "1KD", keyword: "injector" }, query: "1KD Hilux injectors" },
    { id: "hard-zd30", params: { keyword: "ZD30CRD injector" }, query: "ZD30CRD injector bundle" },
    { id: "hard-bt50", params: { keyword: "BT-50 injector" }, query: "Mazda BT-50 injector bundle" },
    { id: "hard-scv-4jj1", params: { keyword: "4JJ1 SCV" }, query: "Isuzu 4JJ1 SCV / suction control valve" },
    {
      id: "hard-hpfp",
      params: { keyword: "HPFP Ranger" },
      query: "Ford Ranger HPFP",
    },
  ];
  for (const entry of famous) {
    cases.push({
      id: entry.id,
      query: entry.query,
      params: entry.params,
      expect: { kind: "non_empty" },
    });
  }

  // Out of catalog
  const negatives = [
    "Honda Civic brake pads",
    "Toyota Corolla spark plugs",
    "Mazda 3 clutch kit",
    "Ford Focus oil filter",
    "wiper blades for Hilux",
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

function buildChatCases(products: CatalogProduct[]): ChatCase[] {
  const cases: ChatCase[] = [
    {
      id: "chat-store-phone",
      query: "What is your phone number?",
      expect: { kind: "store_phone" },
    },
    {
      id: "chat-oos-civic",
      query: "Do you have brake pads for a Honda Civic?",
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
      id: "chat-vague",
      query: "I need injectors for my ute",
      expect: { kind: "no_invented_browse" },
      notes: "Should ask clarifying Q or search broadly — must not invent SKUs/prices not in tools",
    },
  ];

  const priced = products.find((p) => p.sku && Number(p.price) > 0);
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

  // Pre-DPF / +30 classic case from implementation plan
  const plus30 = products.find((p) => /4jj1/i.test(p.title) && /\+30|pre.?dpf/i.test(p.title));
  if (plus30) {
    cases.push({
      id: "chat-4jj1-30-price",
      query: "4JJ1 +30 Injectors Pre-DPF — what is the price?",
      expect: {
        kind: "mentions_price_near",
        productId: plus30.id,
        price: plus30.sale_price || plus30.price,
      },
      notes: plus30.title,
    });
  }

  return cases;
}

function runLayerA(products: CatalogProduct[], cases: SearchCase[]): CaseResult[] {
  const scope = extractCatalogScope(products);
  const results: CaseResult[] = [];

  for (const testCase of cases) {
    const raw = searchProducts(products, testCase.params);
    const enriched = enrichSearchResult(raw, testCase.params, scope);
    const ids = enriched.products.map((p) => p.id);

    let verdict: CaseResult["verdict"] = "PASS";
    let detail = `match=${enriched.match_type} count=${enriched.result_count} oos=${enriched.out_of_catalog_scope}`;

    if (testCase.expect.kind === "contains_product_id") {
      if (!ids.includes(testCase.expect.productId!)) {
        verdict = "FAIL";
        detail += ` | missing id ${testCase.expect.productId}; got [${ids.join(",")}]`;
      }
    } else if (testCase.expect.kind === "out_of_catalog") {
      if (!enriched.out_of_catalog_scope) {
        verdict = "FAIL";
        detail += " | expected out_of_catalog_scope=true";
      }
    } else if (testCase.expect.kind === "non_empty") {
      if (enriched.result_count === 0) {
        verdict = "FAIL";
        detail += " | expected at least one product";
      }
    } else if (testCase.expect.kind === "empty_or_out") {
      if (enriched.result_count > 0 && !enriched.out_of_catalog_scope) {
        verdict = "WARN";
        detail += " | ambiguous — results returned for likely OOS query";
      }
    }

    results.push({
      layer: "A",
      id: testCase.id,
      query: testCase.query,
      verdict,
      detail: testCase.notes ? `${detail} | ${testCase.notes}` : detail,
    });
  }

  return results;
}

/** Parse AI SDK UI SSE stream without relying on readUIMessageStream. */
async function parseChatSse(raw: string): Promise<{ text: string; productIds: number[] }> {
  let text = "";
  const productIds: number[] = [];

  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) {
      continue;
    }
    const payload = line.slice(6).trim();
    if (!payload || payload === "[DONE]") {
      continue;
    }
    try {
      const event = JSON.parse(payload) as {
        type?: string;
        delta?: string;
        text?: string;
        data?: Array<{ id?: number }>;
        output?: { products?: Array<{ id?: number }> };
      };
      if (event.type === "text-delta" && event.delta) {
        text += event.delta;
      }
      if (event.type === "tool-output-available" && Array.isArray(event.output?.products)) {
        for (const product of event.output.products) {
          if (typeof product.id === "number") {
            productIds.push(product.id);
          }
        }
      }
      if (event.type === "data-products" && Array.isArray(event.data)) {
        for (const product of event.data) {
          if (typeof product.id === "number") {
            productIds.push(product.id);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return { text, productIds: [...new Set(productIds)] };
}

async function runOneChat(query: string, sessionId: string): Promise<{
  text: string;
  productIds: number[];
  status: number;
  error?: string;
}> {
  const response = await fetch(CHAT_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
    },
    body: JSON.stringify({
      id: `eval-${sessionId}`,
      messages: [
        {
          id: `u-${Date.now()}`,
          role: "user",
          parts: [{ type: "text", text: query }],
        },
      ],
      sessionId,
      trigger: "submit-message",
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    return {
      text: "",
      productIds: [],
      status: response.status,
      error: raw,
    };
  }

  const parsed = await parseChatSse(raw);
  return {
    text: parsed.text,
    productIds: parsed.productIds,
    status: response.status,
  };
}

function priceMentioned(text: string, price: string): boolean {
  const numeric = Number(price);
  if (Number.isNaN(numeric)) {
    return text.includes(price);
  }
  const whole = Math.round(numeric);
  const withCommas = whole.toLocaleString("en-AU");
  return (
    text.includes(String(whole)) ||
    text.includes(withCommas) ||
    text.includes(numeric.toFixed(2)) ||
    text.includes(`$${whole}`) ||
    text.includes(`$${withCommas}`)
  );
}

async function runLayerB(cases: ChatCase[]): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const [index, testCase] of cases.entries()) {
    const sessionId = `eval-${Date.now()}-${index}`;
    // Stay under IP rate limit (12/min)
    if (index > 0) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 5500));
    }

    const response = await runOneChat(testCase.query, sessionId);
    let verdict: CaseResult["verdict"] = "PASS";
    let detail = `http=${response.status} products=[${response.productIds.join(",")}] text=${response.text
      .replace(/\s+/g, " ")
      .slice(0, 220)}`;

    if (response.error || response.status !== 200) {
      verdict = "FAIL";
      detail = `http=${response.status} error=${(response.error ?? "").slice(0, 300)}`;
    } else if (testCase.expect.kind === "store_phone") {
      if (!/\+?61\s*0?2\s*8529\s*5003|02\s*8529\s*5003/.test(response.text)) {
        verdict = "FAIL";
        detail += " | phone not found";
      }
    } else if (testCase.expect.kind === "out_of_catalog_handoff") {
      const handoff =
        /do not carry|don't carry|don't stock|not carry|contact us|outside/i.test(response.text) ||
        response.productIds.length === 0;
      if (!handoff || /here'?s what i found|in stock/i.test(response.text)) {
        // soft: if it searched and returned unrelated diesel parts, fail
        if (response.productIds.length > 0) {
          verdict = "FAIL";
          detail += " | returned products for out-of-catalog query";
        } else if (!/contact|do not|don't|not stock|not carry/i.test(response.text)) {
          verdict = "WARN";
          detail += " | no clear handoff language";
        }
      }
    } else if (testCase.expect.kind === "has_products") {
      if (response.productIds.length === 0) {
        verdict = "FAIL";
        detail += " | expected product cards from search";
      }
    } else if (testCase.expect.kind === "mentions_price_near") {
      const price = testCase.expect.price ?? "";
      const hasProduct =
        !testCase.expect.productId || response.productIds.includes(testCase.expect.productId);
      if (!hasProduct) {
        verdict = "FAIL";
        detail += ` | expected product ${testCase.expect.productId}`;
      } else if (!priceMentioned(response.text, price) && response.productIds.length === 0) {
        verdict = "FAIL";
        detail += ` | price ${price} not mentioned and no products`;
      } else if (!priceMentioned(response.text, price)) {
        // Cards carry price — text may omit; warn not fail if product id present
        verdict = "WARN";
        detail += ` | product returned but price ${price} not in text (cards may show it)`;
      }
    } else if (testCase.expect.kind === "no_invented_browse") {
      // Fail if it invents a dollar amount with no products
      if (response.productIds.length === 0 && /\$\d{2,}/.test(response.text)) {
        verdict = "FAIL";
        detail += " | dollar amounts with no tool products";
      }
    }

    results.push({
      layer: "B",
      id: testCase.id,
      query: testCase.query,
      verdict,
      detail: testCase.notes ? `${detail} | ${testCase.notes}` : detail,
    });
  }
  return results;
}

function formatReport(
  products: CatalogProduct[],
  results: CaseResult[],
  mattChats: number,
): string {
  const pass = results.filter((r) => r.verdict === "PASS").length;
  const fail = results.filter((r) => r.verdict === "FAIL").length;
  const warn = results.filter((r) => r.verdict === "WARN").length;
  const fails = results.filter((r) => r.verdict === "FAIL");
  const warns = results.filter((r) => r.verdict === "WARN");

  const lines = [
    `# Diesel Geeks chat eval report`,
    ``,
    `- Catalog products: ${products.length}`,
    `- Matt WP user 1 saved chats found: ${mattChats}`,
    `- Layer B (live chat) run: ${RUN_CHAT ? "yes" : "no (pass --chat)"}`,
    `- Totals: PASS ${pass} / FAIL ${fail} / WARN ${warn}`,
    ``,
    `## FAIL cases`,
    ``,
  ];

  if (fails.length === 0) {
    lines.push("_None_");
  } else {
    for (const row of fails) {
      lines.push(`### ${row.id} [${row.layer}]`);
      lines.push(`- Query: ${row.query}`);
      lines.push(`- Detail: ${row.detail}`);
      lines.push(``);
    }
  }

  lines.push(`## WARN cases`, ``);
  if (warns.length === 0) {
    lines.push("_None_");
  } else {
    for (const row of warns) {
      lines.push(`### ${row.id} [${row.layer}]`);
      lines.push(`- Query: ${row.query}`);
      lines.push(`- Detail: ${row.detail}`);
      lines.push(``);
    }
  }

  lines.push(`## All results`, ``);
  lines.push(`| Layer | ID | Verdict | Query |`);
  lines.push(`|---|---|---|---|`);
  for (const row of results) {
    lines.push(`| ${row.layer} | ${row.id} | **${row.verdict}** | ${row.query.replace(/\|/g, "/")} |`);
  }

  lines.push(``);
  lines.push(`## Notes`);
  lines.push(`- No prompt/search fixes applied in this run.`);
  lines.push(`- Matt user id 1 had ${mattChats} server-side conversations — if he tested as guest, full Q&A is not in Redis.`);
  return lines.join("\n");
}

async function main(): Promise<void> {
  mkdirSync("tmp", { recursive: true });
  const products = loadProducts();
  console.log(`Loaded ${products.length} products`);

  let mattChats = 0;
  try {
    const matt = JSON.parse(readFileSync(resolve("tmp-matt-chats-user-1.json"), "utf8")) as unknown[];
    mattChats = Array.isArray(matt) ? matt.length : 0;
  } catch {
    mattChats = 0;
  }

  const searchCases = buildSearchCases(products);
  const layerA = runLayerA(products, searchCases);
  console.log(
    `Layer A: ${layerA.filter((r) => r.verdict === "PASS").length} pass / ${layerA.filter((r) => r.verdict === "FAIL").length} fail`,
  );

  let layerB: CaseResult[] = [];
  if (RUN_CHAT) {
    const chatCases = buildChatCases(products);
    console.log(`Layer B: running ${chatCases.length} live chat cases against ${CHAT_API}`);
    layerB = await runLayerB(chatCases);
    console.log(
      `Layer B: ${layerB.filter((r) => r.verdict === "PASS").length} pass / ${layerB.filter((r) => r.verdict === "FAIL").length} fail`,
    );
  }

  const all = [...layerA, ...layerB];
  const report = formatReport(products, all, mattChats);
  const reportPath = resolve("tmp/eval-report.md");
  const jsonPath = resolve("tmp/eval-results.json");
  writeFileSync(reportPath, report, "utf8");
  writeFileSync(jsonPath, JSON.stringify(all, null, 2), "utf8");
  console.log(`Wrote ${reportPath}`);
  console.log(report);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
