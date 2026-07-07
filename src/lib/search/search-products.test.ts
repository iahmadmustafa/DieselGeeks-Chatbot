import { describe, expect, it } from "vitest";

import { searchProducts } from "@/lib/search/search-products";
import type { CatalogProduct } from "@/types/catalog";

function makeProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: 1,
    sku: "093500-6890",
    title: "105 Series Injectors for 1HZ - Brand New Genuine 093500-6890",
    price: "3168.00",
    sale_price: null,
    stock_status: "instock",
    categories: ["Injectors"],
    permalink: "https://example.com/product/1",
    image_url: "https://example.com/image.jpg",
    short_description: "Genuine Denso injectors for Toyota 1HZ engines.",
    fitment_raw: `Make: Toyota
Models: LandCruiser 105 Series
Engine Code: 1HZ
Fuel Type: Diesel
Fuel System: Mechanical
Year Range:
LandCruiser 105 Series: 1990–2007`,
    fitment: {
      makes: ["Toyota"],
      models: ["LandCruiser 105 Series"],
      engine_codes: ["1HZ"],
      fuel_type: "Diesel",
      fuel_system: "Mechanical",
      year_ranges: {
        "LandCruiser 105 Series": { from: 1990, to: 2007 },
      },
      notes: null,
    },
    fitment_parse_method: "deterministic",
    fitment_parse_error: null,
    fitment_expected: true,
    ...overrides,
  };
}

describe("searchProducts", () => {
  const catalog = [
    makeProduct(),
    makeProduct({
      id: 2,
      sku: "4jj1-pre-dpf",
      title: "4JJ1 +30 Injector Kit (Pre-DPF)",
      price: "3168.00",
      fitment_raw: `Make: Isuzu / Holden
Models: D-Max, MU-X, Colorado RC, Rodeo RA7
Engine Code: 4JJ1 (Pre-DPF only)
Fuel Type: Diesel
Fuel System: Common Rail
Year Range:
Isuzu D-Max: 2007–2016
Isuzu MU-X: 2012–2016`,
      fitment: {
        makes: ["Isuzu", "Holden"],
        models: ["D-Max", "MU-X", "Colorado RC", "Rodeo RA7"],
        engine_codes: ["4JJ1"],
        fuel_type: "Diesel",
        fuel_system: "Common Rail",
        year_ranges: {
          "Isuzu D-Max": { from: 2007, to: 2016 },
          "Isuzu MU-X": { from: 2012, to: 2016 },
        },
        notes: "Pre-DPF only",
      },
    }),
    makeProduct({
      id: 3,
      sku: "diesel-tshirt",
      title: "Diesel Tuner Parody T-shirt",
      price: "35.00",
      categories: ["Apparel"],
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
      fitment_parse_method: "empty",
      fitment_parse_error: "Fitment field is empty",
      fitment_expected: false,
    }),
    makeProduct({
      id: 4,
      sku: "",
      title: "Nissan Patrol ZD30 Injector Set",
      price: "2899.00",
      fitment_raw:
        "Fits Nissan Patrol GU with ZD30 common rail engines. Years 2007 to 2015.",
      fitment: {
        makes: [],
        models: [],
        engine_codes: [],
        fuel_type: null,
        fuel_system: null,
        year_ranges: {},
        notes: null,
      },
      fitment_parse_method: "llm",
      fitment_parse_error: "No structured fitment data (unstructured text)",
      fitment_expected: true,
    }),
  ];

  it("matches SKU and part numbers exactly", () => {
    const result = searchProducts(catalog, { part_number: "093500-6890" });
    expect(result.match_type).toBe("part_number");
    expect(result.products[0]?.id).toBe(1);
  });

  it("matches structured fitment filters", () => {
    const result = searchProducts(catalog, {
      make: "Isuzu",
      model: "D-Max",
      engine_code: "4JJ1",
      year: 2010,
    });

    expect(result.match_type).toBe("structured");
    expect(result.products[0]?.id).toBe(2);
    expect(result.products[0]?.price).toBe("3168.00");
  });

  it("falls back to keyword search over stripped fitment_raw", () => {
    const result = searchProducts(catalog, { keyword: "ZD30 Patrol 2007" });

    expect(result.match_type).toBe("keyword");
    expect(result.products[0]?.id).toBe(4);
  });

  it("finds non-fitment products by title only", () => {
    const result = searchProducts(catalog, { keyword: "parody t-shirt" });

    expect(result.match_type).toBe("keyword");
    expect(result.products[0]?.id).toBe(3);
    expect(result.products[0]?.fitment_expected).toBe(false);
    expect(result.products[0]?.fitment_summary).toBeNull();
  });

  it("excludes non-fitment products from structured vehicle filters", () => {
    const result = searchProducts(catalog, {
      make: "Toyota",
      model: "Hilux",
    });

    expect(result.match_type).toBe("none");
    expect(result.products.some((product) => product.id === 3)).toBe(false);
  });

  it("returns none when nothing matches", () => {
    const result = searchProducts(catalog, { keyword: "xyznonexistent" });
    expect(result.match_type).toBe("none");
    expect(result.result_count).toBe(0);
  });
});
