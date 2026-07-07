import { describe, expect, it } from "vitest";

import {
  assessQueryScope,
  enrichSearchResult,
  extractCatalogScope,
} from "@/lib/catalog/scope";
import type { CatalogProduct } from "@/types/catalog";

function makeCatalogProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: 1,
    sku: "4jj1-kit",
    title: "4JJ1 Pre DPF Injector Kit for Isuzu D-Max",
    price: "3168.00",
    sale_price: null,
    stock_status: "instock",
    categories: ["Injectors"],
    permalink: "https://example.com/4jj1",
    image_url: null,
    short_description: "Common rail injectors for Isuzu D-Max 4JJ1 engines.",
    fitment_raw: "Make: Isuzu\nModels: D-Max\nEngine Code: 4JJ1",
    fitment: {
      makes: ["Isuzu"],
      models: ["D-Max"],
      engine_codes: ["4JJ1"],
      fuel_type: "Diesel",
      fuel_system: "Common Rail",
      year_ranges: { "Isuzu D-Max": { from: 2007, to: 2016 } },
      notes: null,
    },
    fitment_parse_method: "deterministic",
    fitment_parse_error: null,
    fitment_expected: true,
    ...overrides,
  };
}

describe("catalog scope", () => {
  const scope = extractCatalogScope([
    makeCatalogProduct(),
    makeCatalogProduct({
      id: 2,
      title: "Toyota Hilux 1KD Injector Set",
      fitment: {
        makes: ["Toyota"],
        models: ["Hilux"],
        engine_codes: ["1KD"],
        fuel_type: "Diesel",
        fuel_system: "Common Rail",
        year_ranges: { Hilux: { from: 2005, to: 2015 } },
        notes: null,
      },
    }),
    makeCatalogProduct({
      id: 3,
      title: "Diesel Tuner Parody T-shirt",
      categories: ["Apparel"],
      fitment_expected: false,
      fitment_raw: "",
      fitment: {
        makes: [],
        models: [],
        engine_codes: [],
        fuel_type: null,
        fuel_system: null,
        year_ranges: {},
        notes: null,
      },
    }),
  ]);

  it("extracts makes and models from the catalog", () => {
    expect(scope.makes).toEqual(expect.arrayContaining(["Isuzu", "Toyota"]));
    expect(scope.models).toEqual(expect.arrayContaining(["D-Max", "Hilux"]));
  });

  it("flags Honda Civic brake pads as out of catalog scope", () => {
    const assessment = assessQueryScope(
      {
        make: "Honda",
        model: "Civic",
        keyword: "brake pads",
      },
      scope,
    );

    expect(assessment.in_catalog_scope).toBe(false);
    expect(assessment.reason).toMatch(/Honda|brake pads/i);
  });

  it("keeps in-scope diesel injector queries", () => {
    const assessment = assessQueryScope(
      {
        make: "Isuzu",
        model: "D-Max",
        engine_code: "4JJ1",
        year: 2010,
        keyword: "injectors",
      },
      scope,
    );

    expect(assessment.in_catalog_scope).toBe(true);
    expect(assessment.reason).toBeNull();
  });

  it("flags general workshop parts even without a vehicle", () => {
    const assessment = assessQueryScope({ keyword: "brake pads" }, scope);

    expect(assessment.in_catalog_scope).toBe(false);
    expect(assessment.reason).toMatch(/brake pads/i);
  });

  it("enriches search results with immediate dead-end signals", () => {
    const enriched = enrichSearchResult(
      { match_type: "none", result_count: 0, products: [] },
      { make: "Honda", model: "Civic", keyword: "brake pads" },
      scope,
    );

    expect(enriched.out_of_catalog_scope).toBe(true);
    expect(enriched.clarifying_questions_allowed).toBe(false);
    expect(enriched.out_of_scope_reason).toBeTruthy();
  });
});
