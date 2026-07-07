/**
 * Generate fitment-review-list.md and fitment-review-list.csv from the Redis catalog snapshot.
 * Only includes fitment_expected products with parse errors.
 *
 * Usage:
 *   npm run generate-fitment-review-list
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvLocal } from "../src/lib/env/load-env-local";
import { readEnv } from "../src/lib/env/read-env";
import {
  classifyFitmentAttention,
  isFitmentExpected,
} from "../src/lib/fitment/fitment-expected";
import { loadCurrentSnapshot } from "../src/lib/sync/run-sync";
import type { CatalogProduct } from "../src/types/catalog";

function adminEditUrl(productId: number): string {
  const baseUrl = (readEnv("WOOCOMMERCE_URL") ?? "https://stage2.dieselgeeks.com.au").replace(
    /\/$/,
    "",
  );
  return `${baseUrl}/wp-admin/post.php?post=${productId}&action=edit`;
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function productsNeedingAttention(products: CatalogProduct[]) {
  return products
    .filter((product) => {
      const fitmentExpected = product.fitment_expected ?? isFitmentExpected(
        product.title,
        product.categories,
      );
      return fitmentExpected && product.fitment_parse_error;
    })
    .map((product) => ({
      product_id: product.id,
      sku: product.sku,
      title: product.title,
      action_needed: classifyFitmentAttention(
        product.fitment_raw,
        product.fitment_parse_error,
      ),
      parse_error: product.fitment_parse_error!,
      edit_url: adminEditUrl(product.id),
    }))
    .sort((a, b) => a.product_id - b.product_id);
}

async function main(): Promise<void> {
  loadEnvLocal();

  const snapshot = await loadCurrentSnapshot();
  if (!snapshot) {
    console.error("No snapshot found in Redis. Run GET /api/sync first.");
    process.exit(1);
  }

  const items = productsNeedingAttention(snapshot.products);
  const baseUrl = (readEnv("WOOCOMMERCE_URL") ?? "https://stage2.dieselgeeks.com.au").replace(
    /\/$/,
    "",
  );

  const summary = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.action_needed] = (acc[item.action_needed] ?? 0) + 1;
    return acc;
  }, {});

  const mdLines = [
    "# Fitment review list (vehicle parts only)",
    "",
    `**Site:** [${baseUrl.replace("https://", "")}](${baseUrl})  `,
    `**Generated from:** Redis catalog snapshot (${snapshot.synced_at})  `,
    `**Total products in catalog:** ${snapshot.product_count}  `,
    `**Products needing fitment attention:** ${items.length}  `,
    "",
    "Merch, apparel, and promotional bundles are excluded via \`fitment_expected\`.",
    "",
    "| # | Product name | Action needed | Edit link |",
    "|---|---|---|---|",
  ];

  items.forEach((item, index) => {
    const title = item.title.replace(/\|/g, "\\|");
    mdLines.push(
      `| ${index + 1} | ${title} | **${item.action_needed}** | [Edit](${item.edit_url}) |`,
    );
  });

  mdLines.push(
    "",
    "## Summary",
    "",
    "| Action needed | Count |",
    "|---|---|",
  );

  for (const [action, count] of Object.entries(summary).sort()) {
    mdLines.push(`| **${action}** | ${count} |`);
  }

  mdLines.push(
    "",
    "## Excluded from this list",
    "",
    "Products with \`fitment_expected: false\` (T-shirts, Xmas bundles, etc.) are omitted even if fitment is empty.",
    "",
  );

  const csvLines = ["product_id,product_name,action_needed,parse_error,edit_url"];
  for (const item of items) {
    csvLines.push(
      [
        item.product_id,
        escapeCsv(item.title),
        item.action_needed,
        escapeCsv(item.parse_error),
        item.edit_url,
      ].join(","),
    );
  }

  const contextDir = path.join("context");
  await writeFile(path.join(contextDir, "fitment-review-list.md"), `${mdLines.join("\n")}\n`, "utf8");
  await writeFile(
    path.join(contextDir, "fitment-review-list.csv"),
    `${csvLines.join("\n")}\n`,
    "utf8",
  );

  console.log(`Wrote ${items.length} products to context/fitment-review-list.md and .csv`);
  console.log(JSON.stringify({ summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
