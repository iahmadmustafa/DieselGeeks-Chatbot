import { describe, expect, it } from "vitest";

import type { FitmentAuditRow } from "@/lib/fitment/audit";

import {
  extractPartNumbers,
  extractPartNumbersEnhanced,
  extractSpacedBoschPartNumbers,
  normalizePartNumber,
  normalizePartNumberInput,
} from "./extract-part-numbers";
import {
  buildPartNumberIndex,
  enrichAuditRowByPartNumber,
  enrichAuditRowByPartNumberEnhanced,
} from "./match-by-part-number";
import type { VehiclePartSpecRow } from "./types";

const HILUX_8290: VehiclePartSpecRow[] = [
  {
    make: "Toyota",
    model: "Hilux",
    designation: "KUN26R",
    engine: "1KD",
    year: 2005,
    part_number: "095000-8290",
    part_column: "Injector",
  },
  {
    make: "Toyota",
    model: "Hilux",
    designation: "KUN26R",
    engine: "1KD",
    year: 2006,
    part_number: "095000-8290",
    part_column: "Injector",
  },
];

const HILUX_7780: VehiclePartSpecRow[] = [
  {
    make: "Toyota",
    model: "Hilux",
    designation: "KUN26R",
    engine: "1KD",
    year: 2006,
    part_number: "095000-7780",
    part_column: "Injector",
  },
  {
    make: "Toyota",
    model: "Hilux",
    designation: "KUN26R",
    engine: "1KD",
    year: 2009,
    part_number: "095000-7780",
    part_column: "Injector",
  },
  {
    make: "Toyota",
    model: "Prado",
    designation: "120 Series",
    engine: "1KD",
    year: 2008,
    part_number: "095000-7780",
    part_column: "Injector",
  },
];

const HILUX_E3_FLK: VehiclePartSpecRow[] = [
  {
    make: "Toyota",
    model: "Hilux",
    designation: "KUN26R",
    engine: "1KD",
    year: 2005,
    part_number: "1KD E3 FLK",
    part_column: "Fuel Lines (rail > Injectors)",
  },
  {
    make: "Toyota",
    model: "Hilux",
    designation: "KUN26R",
    engine: "1KD",
    year: 2006,
    part_number: "1KD E3 FLK",
    part_column: "Fuel Lines (rail > Injectors)",
  },
];

const RANGER_P5AT_FLK: VehiclePartSpecRow[] = [
  {
    make: "Ford",
    model: "Ranger",
    designation: "PX1",
    engine: "P5AT",
    year: 2011,
    part_number: "P5ATFLK",
    part_column: "Fuel Lines (rail > Injectors)",
  },
  {
    make: "Ford",
    model: "Ranger",
    designation: "PX3",
    engine: "P5AT",
    year: 2021,
    part_number: "P5ATFLK",
    part_column: "Fuel Lines (rail > Injectors)",
  },
];

const ISUZU_4JJ3: VehiclePartSpecRow[] = [
  {
    make: "Isuzu",
    model: "DMAX or MUX",
    designation: "",
    engine: "4JJ3",
    year: 2022,
    part_number: "295700-1060",
    part_column: "Injector",
  },
  {
    make: "Isuzu",
    model: "DMAX or MUX",
    designation: "",
    engine: "4JJ3",
    year: 2025,
    part_number: "295700-1060",
    part_column: "Injector",
  },
];

function auditRow(
  overrides: Partial<FitmentAuditRow> & Pick<FitmentAuditRow, "product_name">,
): FitmentAuditRow {
  return {
    product_id: 1,
    sku: "",
    edit_url: "https://example.com/edit",
    current_fitment_text: "",
    issue_type: "Unstructured Format",
    make: "",
    models: "",
    engine_code: "",
    fuel_type: "",
    year_range: "",
    notes_instructions: "",
    ...overrides,
  };
}

describe("extractPartNumbers", () => {
  it("extracts Denso and Toyota OEM numbers from titles", () => {
    expect(
      extractPartNumbers(
        "23670-0L050 Genuine 1KD Toyota Hilux Injector 095000-8290 for Peak Diesel Performance",
      ),
    ).toEqual(expect.arrayContaining(["095000-8290", "23670-0L050"]));
  });

  it("extracts Ford/Mazda injector numbers from titles", () => {
    expect(
      extractPartNumbers(
        "Genuine Diesel Fuel Injectors CK4Q-9K546-AA for Ford Ranger & Mazda BT50 - A2C8139490080",
      ),
    ).toEqual(expect.arrayContaining(["A2C8139490080", "CK4Q-9K546-AA"]));
  });

  it("normalizes unicode hyphens in enhanced extraction", () => {
    expect(extractPartNumbersEnhanced(new Set(["295700-1060"]), "295700‑1060")).toContain(
      "295700-1060",
    );
  });

  it("normalizes spaced Bosch SKUs in enhanced extraction", () => {
    expect(extractSpacedBoschPartNumbers("0 445 110 877")).toEqual(["0445110877"]);
    expect(extractPartNumbersEnhanced(new Set(), "SKU 0 445 110 250")).toContain("0445110250");
  });

  it("maps Hilux fuel line kit aliases in enhanced extraction", () => {
    expect(extractPartNumbersEnhanced(new Set(["1KD E3 FLK"]), "1KDE3FLK")).toContain(
      "1KDE3FLK",
    );
  });

  it("normalizes part numbers consistently", () => {
    expect(normalizePartNumberInput("295700‑1060")).toBe("295700-1060");
    expect(normalizePartNumber(" 095000-8290 ")).toBe("095000-8290");
    expect(normalizePartNumber("8-98132069-2 (VIGM)")).toBe("8-98132069-2");
  });
});

describe("enrichAuditRowByPartNumber", () => {
  const partIndex = buildPartNumberIndex([...HILUX_8290, ...HILUX_7780]);

  it("fills year range and vehicle fields for 095000-8290 products", () => {
    const enriched = enrichAuditRowByPartNumber(
      auditRow({
        product_id: 10693,
        product_name:
          "23670-0L050 Genuine 1KD Toyota Hilux Injector 095000-8290 for Peak Diesel Performance",
        current_fitment_text:
          "Compatible with Toyota Hilux 1KD Euro 3 (2005-2006). For fitment confirmation, contact here",
      }),
      partIndex,
    );

    expect(enriched?.make).toBe("Toyota");
    expect(enriched?.models).toBe("Hilux");
    expect(enriched?.engine_code).toBe("1KD");
    expect(enriched?.year_range).toBe("Toyota Hilux: 2005–2006");
  });

  it("fills multi-model ranges for 095000-7780 products", () => {
    const enriched = enrichAuditRowByPartNumber(
      auditRow({
        product_id: 11468,
        product_name: "23670-39316 - New 1KD Toyota Hilux Genuine Injector 095000-7780",
      }),
      partIndex,
    );

    expect(enriched?.year_range).toContain("Toyota Hilux: 2006–2009");
    expect(enriched?.year_range).toContain("Toyota Prado: 2008–2008");
  });

  it("does not overwrite existing year ranges", () => {
    expect(
      enrichAuditRowByPartNumber(
        auditRow({
          product_name: "095000-8290",
          year_range: "Toyota Hilux: 2005-2006",
        }),
        partIndex,
      ),
    ).toBeNull();
  });
});

describe("enrichAuditRowByPartNumberEnhanced", () => {
  const known = new Set(["1KD E3 FLK", "P5ATFLK", "295700-1060"]);
  const partIndex = buildPartNumberIndex([
    ...HILUX_E3_FLK,
    ...RANGER_P5AT_FLK,
    ...ISUZU_4JJ3,
  ]);

  it("fills Hilux Euro 3 fuel line kits via alias map", () => {
    const enriched = enrichAuditRowByPartNumberEnhanced(
      auditRow({
        product_id: 11560,
        product_name: "High-Quality 1KD Euro 3 Fuel Lines for Toyota Hilux",
        sku: "1KDE3FLK",
      }),
      partIndex,
      known,
    );

    expect(enriched?.year_range).toBe("Toyota Hilux: 2005–2006");
  });

  it("fills Ford Ranger fuel line kits via exact spreadsheet kit code", () => {
    const enriched = enrichAuditRowByPartNumberEnhanced(
      auditRow({
        product_id: 12437,
        product_name: "Ford Ranger P5AT Fuel Lines | Genuine Ford & Mazda Injector Lines",
        sku: "P5ATFLK",
      }),
      partIndex,
      known,
    );

    expect(enriched?.year_range).toBe("Ford Ranger: 2011–2021");
  });

  it("fills unicode-hyphen SKUs when the spreadsheet part number uses ASCII hyphens", () => {
    const enriched = enrichAuditRowByPartNumberEnhanced(
      auditRow({
        product_id: 14803,
        product_name: "Genuine Denso Injector for Isuzu D-MAX & MU-X – 295700‑1060",
        sku: "295700‑1060",
      }),
      partIndex,
      known,
    );

    expect(enriched?.year_range).toBe("Isuzu DMAX or MUX: 2022–2025");
  });
});
