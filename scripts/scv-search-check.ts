import { readFileSync } from "node:fs";

import { searchProducts } from "@/lib/search/search-products";

const products = JSON.parse(readFileSync("tmp/catalog-snapshot.json", "utf8")).snapshot.products;

for (const q of [
  "4JJ1 SCV",
  "suction control valve 4JJ1",
  "8-98145455-1",
  "Isuzu 4JJ1 suction control valve",
]) {
  const result = searchProducts(products, { keyword: q });
  console.log(
    JSON.stringify({
      q,
      count: result.result_count,
      titles: result.products.map((product: { title: string }) => product.title).slice(0, 3),
    }),
  );
}
