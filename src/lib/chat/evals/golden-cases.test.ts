import { describe, expect, it } from "vitest";

import { buildGoldenSearchCases } from "@/lib/chat/evals/golden-cases";
import { runGoldenLayerA } from "@/lib/chat/evals/run-layer-a";
import { searchProducts } from "@/lib/search/search-products";
import type { CatalogProduct } from "@/types/catalog";

function makeProduct(
  overrides: Partial<CatalogProduct> & Pick<CatalogProduct, "id" | "sku" | "title">,
): CatalogProduct {
  return {
    price: "100",
    sale_price: null,
    stock_status: "instock",
    categories: ["Injectors"],
    permalink: `https://example.com/${overrides.id}`,
    image_url: null,
    short_description: "",
    fitment_raw: "Make: Isuzu\nModels: D-Max\nEngine Code: 4JJ1\nYear Range:\nD-Max: 2007–2016",
    fitment: {
      makes: ["Isuzu"],
      models: ["D-Max"],
      engine_codes: ["4JJ1"],
      fuel_type: "Diesel",
      fuel_system: "Common Rail",
      year_ranges: { "D-Max": { from: 2007, to: 2016 } },
      notes: null,
    },
    fitment_parse_method: "deterministic",
    fitment_parse_error: null,
    fitment_expected: true,
    ...overrides,
  };
}

describe("golden Layer A (fixture catalog)", () => {
  const catalog = [
    makeProduct({
      id: 1,
      sku: "SCV-4JJ1",
      title: "8-98145455-1 Suction Control Valve for Isuzu 4JJ1 Engines",
    }),
    makeProduct({
      id: 2,
      sku: "HPFP-RANGER",
      title: "Genuine High-Pressure Fuel Pump for Ford Ranger",
      fitment: {
        makes: ["Ford"],
        models: ["Ranger"],
        engine_codes: ["P5AT"],
        fuel_type: "Diesel",
        fuel_system: "Common Rail",
        year_ranges: { Ranger: { from: 2011, to: 2018 } },
        notes: null,
      },
    }),
    makeProduct({
      id: 3,
      sku: "4JJ1-KIT",
      title: "4JJ1 +30 Injector Kit (Pre-DPF)",
    }),
  ];

  it("builds a non-trivial golden set", () => {
    const cases = buildGoldenSearchCases(catalog);
    expect(cases.length).toBeGreaterThan(10);
    expect(cases.some((entry) => entry.id.startsWith("oos-"))).toBe(true);
    expect(cases.some((entry) => entry.id === "hard-scv-4jj1")).toBe(true);
  });

  it("passes synonym and out-of-catalog checks on the fixture", () => {
    expect(searchProducts(catalog, { keyword: "4JJ1 SCV" }).products[0]?.id).toBe(1);
    expect(searchProducts(catalog, { keyword: "HPFP Ranger" }).products[0]?.id).toBe(2);

    const cases = buildGoldenSearchCases(catalog).filter(
      (entry) =>
        entry.id.startsWith("oos-") ||
        entry.id === "hard-scv-4jj1" ||
        entry.id === "hard-hpfp" ||
        entry.id === "hard-scv-full" ||
        entry.id.startsWith("sku-") ||
        entry.id.startsWith("year-"),
    );
    const results = runGoldenLayerA(catalog, cases);
    const fails = results.filter((row) => row.verdict === "FAIL");
    expect(fails.map((row) => `${row.id}: ${row.detail}`)).toEqual([]);
  });

  it("excludes out-of-range years even on keyword fallback", () => {
    const result = searchProducts(catalog, {
      make: "Isuzu",
      model: "D-Max",
      engine_code: "4JJ1",
      year: 2002,
    });
    expect(result.products.some((product) => product.id === 1)).toBe(false);
    expect(result.products.some((product) => product.id === 3)).toBe(false);
  });

  it("still finds in-range years with structured filters", () => {
    const result = searchProducts(catalog, {
      make: "Isuzu",
      model: "D-Max",
      engine_code: "4JJ1",
      year: 2010,
    });
    expect(result.products.some((product) => product.id === 1 || product.id === 3)).toBe(true);
  });
});
