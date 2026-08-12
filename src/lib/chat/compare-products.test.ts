import { describe, expect, it } from "vitest";

import type { CatalogProduct } from "@/types/catalog";

import { compareProducts } from "./compare-products";

function product(overrides: Partial<CatalogProduct> & Pick<CatalogProduct, "id" | "sku" | "title">): CatalogProduct {
  return {
    price: "100",
    sale_price: null,
    stock_status: "instock",
    categories: [],
    permalink: `https://example.com/p/${overrides.id}`,
    image_url: null,
    short_description: "",
    fitment_raw: "Make: Isuzu\nModels: D-Max\nEngine Code: 4JJ1",
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

const catalog = [
  product({ id: 1, sku: "INJ-A", title: "Bosch Injector A", price: "500" }),
  product({ id: 2, sku: "INJ-B", title: "Denso Injector B", price: "450" }),
  product({ id: 3, sku: "INJ-C", title: "OEM Injector C", price: "600" }),
];

describe("compareProducts", () => {
  it("compares two products by id", () => {
    const result = compareProducts(catalog, [{ product_id: 1 }, { product_id: 2 }]);
    expect(result.ok).toBe(true);
    expect(result.products.map((entry) => entry.id)).toEqual([1, 2]);
    expect(result.error).toBeNull();
  });

  it("compares up to three products by sku", () => {
    const result = compareProducts(catalog, [
      { sku: "INJ-A" },
      { sku: "INJ-B" },
      { sku: "INJ-C" },
    ]);
    expect(result.ok).toBe(true);
    expect(result.products).toHaveLength(3);
  });

  it("rejects fewer than two resolvable products", () => {
    const result = compareProducts(catalog, [{ product_id: 1 }, { sku: "MISSING" }]);
    expect(result.ok).toBe(false);
    expect(result.unresolved).toContain("MISSING");
  });

  it("dedupes the same product listed twice", () => {
    const result = compareProducts(catalog, [
      { product_id: 1 },
      { sku: "INJ-A" },
      { product_id: 2 },
    ]);
    expect(result.ok).toBe(true);
    expect(result.products.map((entry) => entry.id)).toEqual([1, 2]);
  });
});
