/**
 * Delete all cached fitment parse results (fitment:parse:*) from Upstash Redis.
 *
 * Usage:
 *   npm run clear-fitment-cache
 */
import { loadEnvLocal } from "../src/lib/env/load-env-local";
import { clearFitmentParseCache } from "../src/lib/redis/snapshot";

async function main(): Promise<void> {
  loadEnvLocal();

  const deletedCount = await clearFitmentParseCache();
  console.log(`Deleted ${deletedCount} fitment:parse:* cache key(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
