import { stripHtml } from "@/lib/text/strip-html";
import type { CatalogProduct, NormalizedFitment, YearRange } from "@/types/catalog";

import { classifyFitmentAttention } from "./fitment-expected";
import { parseFitmentDeterministic } from "./parser";

export type FitmentIssueType =
  | "Complete"
  | "Empty"
  | "Missing Year Range"
  | "Unstructured Format"
  | "Other";

export interface FitmentAuditRow {
  product_id: number;
  product_name: string;
  sku: string;
  edit_url: string;
  current_fitment_text: string;
  issue_type: FitmentIssueType;
  make: string;
  models: string;
  engine_code: string;
  fuel_type: string;
  year_range: string;
  notes_instructions: string;
}

function hasHtmlMarkup(text: string): boolean {
  return /<(?:br|p|ul|ol|li|div|span|strong|b|em|i)\b/i.test(text);
}

function formatCurrentFitmentText(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isUsableYearRangeKey(key: string): boolean {
  return !/[<>]/.test(key) && key.trim().length > 0 && key.length <= 80;
}

function formatYearRanges(yearRanges: Record<string, YearRange>): string {
  return Object.entries(yearRanges)
    .filter(([label]) => isUsableYearRangeKey(label))
    .map(([label, range]) => `${label}: ${range.from}–${range.to}`)
    .join("; ");
}

function joinField(values: string[]): string {
  return values.map((value) => value.trim()).filter(Boolean).join(", ");
}

function isEmptyFitment(product: CatalogProduct): boolean {
  const raw = product.fitment_raw.trim();
  return !raw || product.fitment_parse_error === "Fitment field is empty";
}

function hasParsedFitmentFields(fitment: NormalizedFitment): boolean {
  return (
    fitment.makes.length > 0 ||
    fitment.models.length > 0 ||
    fitment.engine_codes.length > 0 ||
    Object.keys(fitment.year_ranges).length > 0
  );
}

function isUnstructuredFitment(product: CatalogProduct): boolean {
  const raw = product.fitment_raw.trim();
  if (!raw) {
    return false;
  }

  const parseError = product.fitment_parse_error;
  const hasParsedData = hasParsedFitmentFields(product.fitment);

  if (classifyFitmentAttention(raw, parseError) === "Add content") {
    return true;
  }

  if (parseError?.toLowerCase().includes("unstructured")) {
    return true;
  }

  if (hasHtmlMarkup(raw) && !hasParsedData) {
    return true;
  }

  if (hasHtmlMarkup(raw) && parseError) {
    return true;
  }

  return false;
}

function isMissingYearRange(product: CatalogProduct): boolean {
  return Object.keys(product.fitment.year_ranges).length === 0;
}

function hasMissingCoreFields(fitment: NormalizedFitment): boolean {
  if (fitment.makes.length === 0) {
    return true;
  }

  if (fitment.models.length === 0 && Object.keys(fitment.year_ranges).length === 0) {
    return true;
  }

  return false;
}

export function classifyFitmentIssueType(product: CatalogProduct): FitmentIssueType {
  if (isEmptyFitment(product)) {
    return "Empty";
  }

  if (isMissingYearRange(product) && hasParsedFitmentFields(product.fitment)) {
    return "Missing Year Range";
  }

  if (isUnstructuredFitment(product)) {
    return "Unstructured Format";
  }

  if (isMissingYearRange(product)) {
    return "Missing Year Range";
  }

  if (product.fitment_parse_error || hasMissingCoreFields(product.fitment)) {
    return "Other";
  }

  return "Other";
}

export function isFitmentIncomplete(product: CatalogProduct): boolean {
  if (!product.fitment_expected) {
    return false;
  }

  if (isEmptyFitment(product)) {
    return true;
  }

  if (product.fitment_parse_error) {
    return true;
  }

  if (isUnstructuredFitment(product)) {
    return true;
  }

  if (isMissingYearRange(product)) {
    return true;
  }

  if (product.fitment.makes.length === 0) {
    return true;
  }

  if (isUnstructuredFitment(product)) {
    return true;
  }

  if (product.fitment_parse_error) {
    return true;
  }

  return false;
}

export function buildFitmentAuditInstructions(issueType: FitmentIssueType): string {
  switch (issueType) {
    case "Complete":
      return "Core fitment fields are populated below. Reformat the fitment tab into the standard Key: value template before publishing if it is still HTML or free text.";
    case "Empty":
      return "Fitment tab is blank. Add structured fitment using the site template: Make / Models / Engine Code / Fuel Type / Fuel System / Year Range (one field per line).";
    case "Missing Year Range":
      return "Year Range is missing or could not be parsed — this is the most common gap. Add explicit ranges per model, e.g. 'Isuzu D-Max: 2007–2016'. Avoid 'Various' without years.";
    case "Unstructured Format":
      return "Fitment is HTML bullets or free text. Reformat into the standard Key: value lines (Make, Models, Engine Code, Fuel Type, Year Range). Remove contact-only placeholders.";
    case "Other":
      return "Fitment is incomplete or partially parsed. Fill any blank columns below and ensure all key fields use the standard template format.";
  }
}

/** Classify issue type from enriched row values (after auto-fill passes). */
export function classifyEnrichedAuditIssueType(
  row: Pick<FitmentAuditRow, "make" | "models" | "engine_code" | "year_range" | "current_fitment_text">,
): FitmentIssueType {
  const hasMake = row.make.trim().length > 0;
  const hasModels = row.models.trim().length > 0;
  const hasEngine = row.engine_code.trim().length > 0;
  const hasYearRange = row.year_range.trim().length > 0;

  if (hasMake && hasModels && hasEngine && hasYearRange) {
    return "Complete";
  }

  if (
    !row.current_fitment_text.trim() &&
    !hasMake &&
    !hasModels &&
    !hasEngine &&
    !hasYearRange
  ) {
    return "Empty";
  }

  if (!hasYearRange && hasMake && hasModels && hasEngine) {
    return "Missing Year Range";
  }

  return "Other";
}

export function refreshAuditRowIssueType(row: FitmentAuditRow): FitmentAuditRow {
  const issueType = classifyEnrichedAuditIssueType(row);

  return {
    ...row,
    issue_type: issueType,
    notes_instructions: buildFitmentAuditInstructions(issueType),
  };
}

function resolveAuditFitment(product: CatalogProduct): NormalizedFitment {
  const reparsed = parseFitmentDeterministic(product.fitment_raw);
  if (reparsed.parseError === null && hasParsedFitmentFields(reparsed.fitment)) {
    return reparsed.fitment;
  }

  return product.fitment;
}

export function buildFitmentAuditRow(
  product: CatalogProduct,
  editUrl: string,
): FitmentAuditRow {
  const issueType = classifyFitmentIssueType(product);
  const fitment = resolveAuditFitment(product);

  return {
    product_id: product.id,
    product_name: product.title,
    sku: product.sku,
    edit_url: editUrl,
    current_fitment_text: formatCurrentFitmentText(product.fitment_raw),
    issue_type: issueType,
    make: joinField(fitment.makes),
    models: joinField(fitment.models),
    engine_code: joinField(fitment.engine_codes),
    fuel_type: fitment.fuel_type ?? "",
    year_range: formatYearRanges(fitment.year_ranges),
    notes_instructions: buildFitmentAuditInstructions(issueType),
  };
}

export function collectFitmentAuditRows(
  products: CatalogProduct[],
  editUrlForProduct: (productId: number) => string,
): FitmentAuditRow[] {
  return products
    .filter((product) => isFitmentIncomplete(product))
    .map((product) => buildFitmentAuditRow(product, editUrlForProduct(product.id)))
    .sort((left, right) => left.product_id - right.product_id);
}

/** Plain-text preview for debugging (strips HTML without preserving line breaks). */
export function previewFitmentRaw(raw: string, maxLength = 300): string {
  const cleaned = stripHtml(raw);
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return `${cleaned.slice(0, maxLength)}…`;
}
