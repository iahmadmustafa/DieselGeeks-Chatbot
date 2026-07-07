/**
 * Dump normalized fitment records from Redis for human review (Phase 1 deliverable).
 *
 * Usage:
 *   npx tsx scripts/dump-fitment.ts
 *   npx tsx scripts/dump-fitment.ts --out context/fitment-dump.json
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getFitmentReviewList } from "../src/lib/redis/snapshot";
import { loadCurrentSnapshot } from "../src/lib/sync/run-sync";

async function main(): Promise<void> {
  const outArgIndex = process.argv.indexOf("--out");
  const outputPath =
    outArgIndex !== -1
      ? process.argv[outArgIndex + 1]
      : path.join("context", "fitment-dump.json");

  const snapshot = await loadCurrentSnapshot();

  if (!snapshot) {
    console.error("No snapshot found in Redis. Run GET /api/sync first.");
    process.exit(1);
  }

  const reviewItems = await getFitmentReviewList();

  const dump = {
    generated_at: new Date().toISOString(),
    snapshot_version: snapshot.version,
    synced_at: snapshot.synced_at,
    product_count: snapshot.product_count,
    parse_failure_count: reviewItems.length,
    products: snapshot.products.map((product) => ({
      id: product.id,
      sku: product.sku,
      title: product.title,
      fitment_raw: product.fitment_raw,
      fitment: product.fitment,
      fitment_parse_method: product.fitment_parse_method,
      fitment_parse_error: product.fitment_parse_error,
    })),
    review_items: reviewItems,
  };

  const resolved = path.resolve(outputPath);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(dump, null, 2)}\n`, "utf8");

  console.log(`Wrote ${snapshot.product_count} products to ${resolved}`);
  console.log(`Parse failures flagged for review: ${reviewItems.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
