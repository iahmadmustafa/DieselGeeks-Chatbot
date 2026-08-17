import { enrichSearchResult, extractCatalogScope } from "@/lib/catalog/scope";
import { searchProducts } from "@/lib/search/search-products";
import type { CatalogProduct } from "@/types/catalog";

import type { CaseResult, SearchCase } from "@/lib/chat/evals/types";

export function runGoldenLayerA(
  products: CatalogProduct[],
  cases: SearchCase[],
): CaseResult[] {
  const scope = extractCatalogScope(products);
  const results: CaseResult[] = [];

  for (const testCase of cases) {
    const raw = searchProducts(products, testCase.params);
    const enriched = enrichSearchResult(raw, testCase.params, scope);
    const ids = enriched.products.map((product) => product.id);

    let verdict: CaseResult["verdict"] = "PASS";
    let detail = `match=${enriched.match_type} count=${enriched.result_count} oos=${enriched.out_of_catalog_scope}`;

    if (testCase.expect.kind === "contains_product_id") {
      if (!ids.includes(testCase.expect.productId!)) {
        verdict = "FAIL";
        detail += ` | missing id ${testCase.expect.productId}; got [${ids.join(",")}]`;
      }
    } else if (testCase.expect.kind === "excludes_product_id") {
      if (ids.includes(testCase.expect.productId!)) {
        verdict = "FAIL";
        detail += ` | product ${testCase.expect.productId} should be excluded; got [${ids.join(",")}]`;
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
