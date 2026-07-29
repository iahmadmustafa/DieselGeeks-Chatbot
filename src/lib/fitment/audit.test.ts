import { describe, expect, it } from "vitest";

import {
  classifyFitmentIssueType,
  collectFitmentAuditRows,
  isFitmentIncomplete,
} from "@/lib/fitment/audit";
import type { CatalogProduct } from "@/types/catalog";

function makeProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: 100,
    sku: "test-sku",
    title: "Test Injector Kit",
    price: "100",
    sale_price: null,
    stock_status: "instock",
    categories: ["Injectors"],
    permalink: "https://example.com/product",
    image_url: null,
    short_description: "",
    fitment_raw: "Make: Isuzu\nModels: D-Max\nEngine Code: 4JJ1\nYear Range: Isuzu D-Max: 2007–2016",
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

describe("fitment audit", () => {
  it("excludes complete fitment-expected products", () => {
    expect(isFitmentIncomplete(makeProduct())).toBe(false);
  });

  it("flags empty fitment", () => {
    const product = makeProduct({
      fitment_raw: "",
      fitment_parse_error: "Fitment field is empty",
      fitment: {
        makes: [],
        models: [],
        engine_codes: [],
        fuel_type: null,
        fuel_system: null,
        year_ranges: {},
        notes: null,
      },
    });

    expect(isFitmentIncomplete(product)).toBe(true);
    expect(classifyFitmentIssueType(product)).toBe("Empty");
  });

  it("flags missing year range even when make/model/engine parsed", () => {
    const product = makeProduct({
      fitment_raw: "Make: Detroit Diesel\nModels: DD15\nEngine Code: DD15\nYear Range: Various",
      fitment: {
        makes: ["Detroit Diesel"],
        models: ["DD15"],
        engine_codes: ["DD15"],
        fuel_type: "Diesel",
        fuel_system: "Common Rail",
        year_ranges: {},
        notes: "Year Range: Various (verify by VIN)",
      },
      fitment_parse_error: null,
    });

    expect(isFitmentIncomplete(product)).toBe(true);
    expect(classifyFitmentIssueType(product)).toBe("Missing Year Range");
  });

  it("flags unstructured HTML fitment", () => {
    const product = makeProduct({
      fitment_raw: "<ul><li><strong>Toyota Hilux</strong> 1KD</li></ul>",
      fitment_parse_error: "No structured fitment data (unstructured text)",
      fitment: {
        makes: [],
        models: [],
        engine_codes: [],
        fuel_type: null,
        fuel_system: null,
        year_ranges: {},
        notes: null,
      },
    });

    expect(isFitmentIncomplete(product)).toBe(true);
    expect(classifyFitmentIssueType(product)).toBe("Unstructured Format");
  });

  it("builds audit rows with pre-filled parsed fields", () => {
    const rows = collectFitmentAuditRows(
      [
        makeProduct({
          id: 15630,
          fitment_raw:
            "Make: Isuzu\nModels: D-Max\nEngine Code: 4JJ1\nYear Range:\nIsuzu D-Max: 2007–2016",
          fitment: {
            makes: ["Isuzu"],
            models: ["D-Max"],
            engine_codes: ["4JJ1"],
            fuel_type: "Diesel",
            fuel_system: "Common Rail",
            year_ranges: {},
            notes: null,
          },
        }),
      ],
      (id) => `https://example.com/wp-admin/post.php?post=${id}&action=edit`,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.make).toBe("Isuzu");
    expect(rows[0]?.year_range).toBe("Isuzu D-Max: 2007–2016");
    expect(rows[0]?.issue_type).toBe("Missing Year Range");
  });
});
