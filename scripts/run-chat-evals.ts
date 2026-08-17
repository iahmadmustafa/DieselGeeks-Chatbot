/**
 * Golden evals for Diesel Geeks chat (Layer A search + optional Layer B live chat).
 * Report only — does not auto-fix product/prompt code.
 *
 * Usage:
 *   npm run eval:chat
 *   npm run eval:chat:live
 *
 * Requires tmp/catalog-snapshot.json (fetch via /api/catalog with CRON_SECRET).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildGoldenChatCases, buildGoldenSearchCases } from "../src/lib/chat/evals/golden-cases";
import { runGoldenLayerA } from "../src/lib/chat/evals/run-layer-a";
import type { CaseResult, ChatCase } from "../src/lib/chat/evals/types";
import { loadEnvLocal } from "../src/lib/env/load-env-local";
import type { CatalogProduct, ProductSnapshot } from "../src/types/catalog";

loadEnvLocal();

const CHAT_API = process.env.EVAL_CHAT_API_URL ?? "https://diesel-geeks-chatbot.vercel.app/api/chat";
const ORIGIN = process.env.EVAL_ORIGIN ?? "https://stage2.dieselgeeks.com.au";
const RUN_CHAT = process.argv.includes("--chat");

function loadProducts(): CatalogProduct[] {
  const path = resolve("tmp/catalog-snapshot.json");
  if (!existsSync(path)) {
    throw new Error(
      "Missing tmp/catalog-snapshot.json — fetch GET /api/catalog with CRON_SECRET first",
    );
  }
  const raw = JSON.parse(readFileSync(path, "utf8")) as {
    snapshot?: ProductSnapshot;
    products?: CatalogProduct[];
  };
  const products = raw.snapshot?.products ?? raw.products;
  if (!products?.length) {
    throw new Error("No products in catalog snapshot");
  }
  return products;
}

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
    return { text: "", productIds: [], status: response.status, error: raw };
  }

  const parsed = await parseChatSse(raw);
  return { text: parsed.text, productIds: parsed.productIds, status: response.status };
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

function scoreChatCase(
  testCase: ChatCase,
  response: { text: string; productIds: number[]; status: number; error?: string },
): CaseResult {
  let verdict: CaseResult["verdict"] = "PASS";
  let detail = `http=${response.status} products=[${response.productIds.join(",")}] text=${response.text
    .replace(/\s+/g, " ")
    .slice(0, 220)}`;

  if (response.error || response.status !== 200) {
    return {
      layer: "B",
      id: testCase.id,
      query: testCase.query,
      verdict: "FAIL",
      detail: `http=${response.status} error=${(response.error ?? "").slice(0, 300)}`,
    };
  }

  if (testCase.expect.kind === "store_phone") {
    if (!/\+?61\s*0?2\s*8529\s*5003|02\s*8529\s*5003/.test(response.text)) {
      verdict = "FAIL";
      detail += " | phone not found";
    }
  } else if (testCase.expect.kind === "store_address") {
    if (!/auburn|coniston|2500/i.test(response.text)) {
      verdict = "FAIL";
      detail += " | address not found";
    }
  } else if (testCase.expect.kind === "store_hours") {
    if (!/monday|mon|9(?::00)?\s*am|9am|5(?::00)?\s*pm|5pm/i.test(response.text)) {
      verdict = "FAIL";
      detail += " | hours not found";
    }
  } else if (testCase.expect.kind === "out_of_catalog_handoff") {
    if (response.productIds.length > 0) {
      verdict = "FAIL";
      detail += " | returned products for out-of-catalog query";
    } else if (!/contact|do not|don't|not stock|not carry|don't carry|outside/i.test(response.text)) {
      verdict = "WARN";
      detail += " | no clear handoff language";
    }
  } else if (testCase.expect.kind === "has_products") {
    if (response.productIds.length === 0) {
      verdict = "FAIL";
      detail += " | expected product cards from search";
    }
  } else if (testCase.expect.kind === "contains_product_id") {
    if (!response.productIds.includes(testCase.expect.productId!)) {
      verdict = "FAIL";
      detail += ` | expected product ${testCase.expect.productId}`;
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
      verdict = "WARN";
      detail += ` | product returned but price ${price} not in text (cards may show it)`;
    }
  } else if (testCase.expect.kind === "no_invented_browse") {
    if (response.productIds.length === 0 && /\$\d{2,}/.test(response.text)) {
      verdict = "FAIL";
      detail += " | dollar amounts with no tool products";
    }
  } else if (testCase.expect.kind === "asks_clarifying") {
    if (response.productIds.length === 0 && /\$\d{2,}/.test(response.text)) {
      verdict = "FAIL";
      detail += " | invented prices without products";
    } else if (
      response.productIds.length === 0 &&
      !/\?|which|tell me|make|model|year|sku|compare|vehicle/i.test(response.text)
    ) {
      verdict = "WARN";
      detail += " | expected a clarifying question";
    }
  }

  return {
    layer: "B",
    id: testCase.id,
    query: testCase.query,
    verdict,
    detail: testCase.notes ? `${detail} | ${testCase.notes}` : detail,
  };
}

async function runLayerB(cases: ChatCase[]): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const [index, testCase] of cases.entries()) {
    if (index > 0) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 5500));
    }
    const response = await runOneChat(testCase.query, `eval-${Date.now()}-${index}`);
    results.push(scoreChatCase(testCase, response));
  }
  return results;
}

function formatReport(products: CatalogProduct[], results: CaseResult[]): string {
  const pass = results.filter((row) => row.verdict === "PASS").length;
  const fail = results.filter((row) => row.verdict === "FAIL").length;
  const warn = results.filter((row) => row.verdict === "WARN").length;
  const fails = results.filter((row) => row.verdict === "FAIL");
  const warns = results.filter((row) => row.verdict === "WARN");

  const lines = [
    `# Diesel Geeks golden eval report`,
    ``,
    `- Catalog products: ${products.length}`,
    `- Layer B (live chat): ${RUN_CHAT ? "yes" : "no (npm run eval:chat:live)"}`,
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
    lines.push(
      `| ${row.layer} | ${row.id} | **${row.verdict}** | ${row.query.replace(/\|/g, "/")} |`,
    );
  }

  lines.push(``);
  lines.push(`## Notes`);
  lines.push(`- Report only — no auto-fixes in this run.`);
  return lines.join("\n");
}

async function main(): Promise<void> {
  mkdirSync("tmp", { recursive: true });
  const products = loadProducts();
  console.log(`Loaded ${products.length} products`);

  const searchCases = buildGoldenSearchCases(products);
  const layerA = runGoldenLayerA(products, searchCases);
  console.log(
    `Layer A (${searchCases.length} cases): ${layerA.filter((row) => row.verdict === "PASS").length} pass / ${layerA.filter((row) => row.verdict === "FAIL").length} fail / ${layerA.filter((row) => row.verdict === "WARN").length} warn`,
  );

  let layerB: CaseResult[] = [];
  if (RUN_CHAT) {
    const chatCases = buildGoldenChatCases(products);
    console.log(`Layer B: ${chatCases.length} live chat cases → ${CHAT_API}`);
    layerB = await runLayerB(chatCases);
    console.log(
      `Layer B: ${layerB.filter((row) => row.verdict === "PASS").length} pass / ${layerB.filter((row) => row.verdict === "FAIL").length} fail / ${layerB.filter((row) => row.verdict === "WARN").length} warn`,
    );
  }

  const all = [...layerA, ...layerB];
  const report = formatReport(products, all);
  writeFileSync(resolve("tmp/eval-report.md"), report, "utf8");
  writeFileSync(resolve("tmp/eval-results.json"), JSON.stringify(all, null, 2), "utf8");
  console.log("Wrote tmp/eval-report.md");
  console.log(report);

  if (all.some((row) => row.verdict === "FAIL")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
