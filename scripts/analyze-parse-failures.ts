import { loadEnvLocal } from "../src/lib/env/load-env-local";
import { getFitmentReviewList } from "../src/lib/redis/snapshot";
import { classifyParseFailure } from "../src/lib/fitment/parse-failure";

async function main(): Promise<void> {
  loadEnvLocal();
  const items = await getFitmentReviewList();

  const classified = items.map((item) => ({
    product_id: item.product_id,
    sku: item.sku,
    title: item.title,
    parse_method: item.parse_method,
    parse_error: item.parse_error,
    category: classifyParseFailure(item.parse_error, item.fitment_raw),
    fitment_raw_preview: item.fitment_raw.slice(0, 140),
  }));

  const summary = classified.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({ total: items.length, summary, items: classified }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
