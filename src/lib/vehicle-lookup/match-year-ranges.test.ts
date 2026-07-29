import { describe, expect, it } from "vitest";

import type { FitmentAuditRow } from "@/lib/fitment/audit";

import { enrichMissingYearRangeRows, lookupYearRangesForAuditRow } from "./match-year-ranges";
import { enginesMatch, modelsMatch, normalizeEngine, splitCsvField } from "./normalize";
import type { VehicleSpecRow } from "./types";

const SAMPLE_SPECS: VehicleSpecRow[] = [
  { make: "Toyota", model: "Hilux", designation: "KUN26R", engine: "1KD", year: 2005 },
  { make: "Toyota", model: "Hilux", designation: "KUN26R", engine: "1KD", year: 2015 },
  { make: "Toyota", model: "Prado", designation: "150 Series", engine: "1KD", year: 2009 },
  { make: "Toyota", model: "Prado", designation: "150 Series", engine: "1KD", year: 2015 },
  { make: "Toyota", model: "Landcruiser 70", designation: "76 Series / 79 Series", engine: "1VD", year: 2007 },
  { make: "Toyota", model: "Landcruiser 70", designation: "76 Series / 79 Series", engine: "1VD", year: 2025 },
  { make: "Toyota", model: "Landcruiser 200", designation: "200 Series", engine: "1VD", year: 2007 },
  { make: "Toyota", model: "Landcruiser 200", designation: "200 Series", engine: "1VD", year: 2021 },
  { make: "Toyota", model: "Land Cruiser", designation: "105", engine: "1HZ", year: 1998 },
  { make: "Toyota", model: "Land Cruiser", designation: "105", engine: "1HZ", year: 2007 },
  { make: "Toyota", model: "Land Cruiser", designation: "100", engine: "1HD-FTE", year: 1998 },
  { make: "Toyota", model: "Land Cruiser", designation: "100", engine: "1HD-FTE", year: 2006 },
  { make: "Isuzu", model: "DMAX or MUX", designation: "RC", engine: "4JJ1", year: 2007 },
  { make: "Isuzu", model: "DMAX or MUX", designation: "RG", engine: "4JJ1", year: 2020 },
  { make: "Ford", model: "Ranger", designation: "PX1", engine: "P5AT", year: 2011 },
  { make: "Ford", model: "Ranger", designation: "PX3", engine: "P5AT", year: 2021 },
  { make: "Ford", model: "Ranger", designation: "PX1", engine: "P4AT", year: 2011 },
  { make: "Ford", model: "Ranger", designation: "PX3", engine: "P4AT", year: 2021 },
  { make: "Nissan", model: "Navara D40", designation: "D40 Spain Built", engine: "YD25", year: 2005 },
  { make: "Nissan", model: "Navara D40", designation: "D40 Thai Built", engine: "YD25", year: 2015 },
  { make: "Nissan", model: "Patrol", designation: "Y61", engine: "ZD30DDTi", year: 1999 },
  { make: "Nissan", model: "Patrol", designation: "Y61", engine: "ZD30CRD", year: 2014 },
  { make: "Nissan", model: "Patrol", designation: "Y60", engine: "TD42", year: 1989 },
  { make: "Nissan", model: "Patrol", designation: "Y61", engine: "TD42Ti", year: 2007 },
];

function auditRow(
  overrides: Partial<FitmentAuditRow> & Pick<FitmentAuditRow, "make" | "models" | "engine_code">,
): FitmentAuditRow {
  return {
    product_id: 1,
    product_name: "Test Product",
    sku: "",
    edit_url: "https://example.com/edit",
    current_fitment_text: "",
    issue_type: "Missing Year Range",
    fuel_type: "Diesel",
    year_range: "",
    notes_instructions: "",
    ...overrides,
  };
}

describe("vehicle lookup normalize", () => {
  it("matches engine code variants", () => {
    expect(normalizeEngine("1KD-FTV")).toBe("1kd");
    expect(normalizeEngine("1VD-FTV")).toBe("1vd");
    expect(enginesMatch("ZD30", "ZD30DDTi")).toBe(true);
    expect(enginesMatch("YD25", "YD2K")).toBe(false);
  });

  it("matches LandCruiser series variants", () => {
    expect(modelsMatch("LandCruiser 70 Series", "Landcruiser 70", "76 Series / 79 Series")).toBe(true);
    expect(modelsMatch("LandCruiser 105 Series", "Land Cruiser", "105")).toBe(true);
    expect(modelsMatch("Toyota Land Cruiser 75 Series", "Land Cruiser", "80")).toBe(false);
    expect(modelsMatch("Toyota Land Cruiser 70 Series", "Land Cruiser", "100")).toBe(false);
  });

  it("splits comma-separated fields inside parentheses", () => {
    expect(splitCsvField("Patrol (GQ, GU Series), Civilian Bus")).toEqual([
      "Patrol (GQ, GU Series)",
      "Civilian Bus",
    ]);
  });
});

describe("vehicle year range lookup", () => {
  it("fills Hilux and Prado ranges for 1KD products", () => {
    const result = lookupYearRangesForAuditRow(
      auditRow({
        make: "Toyota",
        models: "Toyota Hiace, Toyota Hilux, Toyota Prado",
        engine_code: "1KD",
      }),
      SAMPLE_SPECS,
    );

    expect(result).toContain("Toyota Hilux: 2005–2015");
    expect(result).toContain("Toyota Prado: 2009–2015");
    expect(result).not.toContain("Hiace");
  });

  it("fills 1VD LandCruiser 70 and 200 series", () => {
    const result = lookupYearRangesForAuditRow(
      auditRow({
        make: "Toyota",
        models: "LandCruiser 70 Series, 200 Series",
        engine_code: "1VD",
      }),
      SAMPLE_SPECS,
    );

    expect(result).toContain("Toyota LandCruiser 70 Series: 2007–2025");
    expect(result).toContain("Toyota LandCruiser 200 Series: 2007–2021");
  });

  it("fills Isuzu and Holden platform ranges from 4JJ1 data", () => {
    const result = lookupYearRangesForAuditRow(
      auditRow({
        make: "Isuzu, Holden",
        models: "D-MAX, MU-X, Colorado",
        engine_code: "4JJ1",
      }),
      SAMPLE_SPECS,
    );

    expect(result).toContain("D-MAX: 2007–2020");
    expect(result).toContain("MU-X: 2007–2020");
    expect(result).toContain("Colorado: 2007–2020");
  });

  it("fills Ford Ranger and Mazda BT-50 from shared PX engines", () => {
    const result = lookupYearRangesForAuditRow(
      auditRow({
        make: "Ford, Mazda",
        models: "Ford Ranger, Mazda BT-50",
        engine_code: "P4AT, P5AT",
      }),
      SAMPLE_SPECS,
    );

    expect(result).toContain("Ford Ranger: 2011–2021");
    expect(result).toContain("Mazda BT-50: 2011–2021");
  });

  it("leaves unmatched products blank", () => {
    expect(
      lookupYearRangesForAuditRow(
        auditRow({ make: "Ford", models: "Transit", engine_code: "2.2L - 85HP" }),
        SAMPLE_SPECS,
      ),
    ).toBe("");
  });

  it("enriches only missing year range rows", () => {
    const rows = enrichMissingYearRangeRows(
      [
        auditRow({ make: "Toyota", models: "Hilux", engine_code: "1KD-FTV" }),
        auditRow({
          make: "Ford",
          models: "Transit",
          engine_code: "2.2L",
          issue_type: "Missing Year Range",
        }),
        auditRow({
          make: "Toyota",
          models: "Hilux",
          engine_code: "1KD",
          issue_type: "Unstructured Format",
        }),
      ],
      SAMPLE_SPECS,
    );

    expect(rows[0]?.year_range).toBe("Toyota Hilux: 2005–2015");
    expect(rows[1]?.year_range).toBe("");
    expect(rows[2]?.year_range).toBe("");
  });
});
