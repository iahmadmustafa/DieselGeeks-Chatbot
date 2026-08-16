import { readFileSync } from "node:fs";
import { searchProducts } from "./src/lib/search/search-products.ts";
import { enrichSearchResult, extractCatalogScope } from "./src/lib/catalog/scope.ts";
const products = JSON.parse(readFileSync("tmp/catalog-snapshot.json","utf8")).snapshot.products;
for (const q of ["4JJ1 SCV", "suction control valve 4JJ1", "8-98145455-1", "Isuzu 4JJ1 suction control valve"]) {
  const r = searchProducts(products, { keyword: q });
  console.log(JSON.stringify({ q, count: r.result_count, titles: r.products.map(p=>p.title).slice(0,3) }));
}
