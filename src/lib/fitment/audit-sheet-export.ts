import type { FitmentAuditRow } from "@/lib/fitment/audit";

/** Core fitment columns Lea must fill manually — Fuel Type is lower priority. */
const MANUAL_INPUT_FIELDS = ["make", "models", "engine_code", "year_range"] as const;

export type ManualFitmentField = (typeof MANUAL_INPUT_FIELDS)[number];

/** True when any priority fitment column is still blank after auto-fill. */
export function rowNeedsManualFitmentInput(
  row: Pick<FitmentAuditRow, ManualFitmentField>,
): boolean {
  return MANUAL_INPUT_FIELDS.some((field) => !row[field].trim());
}

export function missingManualFitmentFields(
  row: Pick<FitmentAuditRow, ManualFitmentField>,
): ManualFitmentField[] {
  return MANUAL_INPUT_FIELDS.filter((field) => !row[field].trim());
}

/** Excel on Windows often misreads UTF-8 punctuation from CSV; normalize for export. */
export function sanitizeForExcelExport(value: string): string {
  return value
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"');
}

export const FITMENT_AUDIT_HEADERS = [
  "Product ID",
  "Product Name",
  "Edit URL",
  "Current Fitment Text",
  "Issue Type",
  "Make",
  "Models",
  "Engine Code",
  "Fuel Type",
  "Year Range",
  "Notes/Instructions",
] as const;

export function fitmentAuditRowToCells(row: FitmentAuditRow): Array<string | number> {
  return [
    row.product_id,
    sanitizeForExcelExport(row.product_name),
    sanitizeForExcelExport(row.edit_url),
    sanitizeForExcelExport(row.current_fitment_text),
    sanitizeForExcelExport(row.issue_type),
    sanitizeForExcelExport(row.make),
    sanitizeForExcelExport(row.models),
    sanitizeForExcelExport(row.engine_code),
    sanitizeForExcelExport(row.fuel_type),
    sanitizeForExcelExport(row.year_range),
    sanitizeForExcelExport(row.notes_instructions),
  ];
}
