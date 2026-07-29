import { describe, expect, it } from "vitest";

import type { FitmentAuditRow } from "@/lib/fitment/audit";
import {
  classifyEnrichedAuditIssueType,
  refreshAuditRowIssueType,
} from "@/lib/fitment/audit";

import {
  missingManualFitmentFields,
  rowNeedsManualFitmentInput,
} from "@/lib/fitment/audit-sheet-export";

function auditRow(
  overrides: Partial<FitmentAuditRow> = {},
): FitmentAuditRow {
  return {
    product_id: 1,
    product_name: "Test Product",
    sku: "",
    edit_url: "https://example.com/edit",
    current_fitment_text: "Make: Toyota",
    issue_type: "Unstructured Format",
    make: "Toyota",
    models: "Hilux",
    engine_code: "1KD",
    fuel_type: "Diesel",
    year_range: "Toyota Hilux: 2005-2015",
    notes_instructions: "",
    ...overrides,
  };
}

describe("classifyEnrichedAuditIssueType", () => {
  it("marks rows complete when all core fields are populated", () => {
    expect(classifyEnrichedAuditIssueType(auditRow())).toBe("Complete");
  });

  it("still flags missing year range when other core fields are filled", () => {
    expect(
      classifyEnrichedAuditIssueType(
        auditRow({ year_range: "", issue_type: "Unstructured Format" }),
      ),
    ).toBe("Missing Year Range");
  });

  it("refreshes stale unstructured labels after enrichment", () => {
    const refreshed = refreshAuditRowIssueType(
      auditRow({
        issue_type: "Unstructured Format",
        notes_instructions: "old note",
      }),
    );

    expect(refreshed.issue_type).toBe("Complete");
    expect(refreshed.notes_instructions).toContain("Core fitment fields are populated");
  });
});

describe("rowNeedsManualFitmentInput", () => {
  it("does not flag rows with only Fuel Type missing", () => {
    expect(
      rowNeedsManualFitmentInput(
        auditRow({
          fuel_type: "",
        }),
      ),
    ).toBe(false);
    expect(missingManualFitmentFields(auditRow({ fuel_type: "" }))).toEqual([]);
  });

  it("flags rows missing any priority core field", () => {
    expect(rowNeedsManualFitmentInput(auditRow({ year_range: "" }))).toBe(true);
    expect(rowNeedsManualFitmentInput(auditRow({ make: "" }))).toBe(true);
  });
});
