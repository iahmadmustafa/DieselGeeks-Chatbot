import type { FitmentAuditRow } from "@/lib/fitment/audit";

import {
  extractPartNumbers,
  extractPartNumbersEnhanced,
  normalizePartNumber,
  partNumberLookupKeys,
} from "./extract-part-numbers";
import { formatYearRangeFromPartMatches, joinUniqueValues } from "./format-enrichment";
import type { VehiclePartSpecRow } from "./types";

export function buildPartNumberIndex(
  partSpecs: VehiclePartSpecRow[],
): Map<string, VehiclePartSpecRow[]> {
  const index = new Map<string, VehiclePartSpecRow[]>();

  for (const spec of partSpecs) {
    for (const key of partNumberLookupKeys(spec.part_number)) {
      const existing = index.get(key) ?? [];
      existing.push(spec);
      index.set(key, existing);
    }
  }

  return index;
}

function lookupPartSpecsForCandidates(
  partIndex: Map<string, VehiclePartSpecRow[]>,
  partNumbers: string[],
): VehiclePartSpecRow[] {
  const matches: VehiclePartSpecRow[] = [];
  const seen = new Set<string>();

  for (const partNumber of partNumbers) {
    for (const key of partNumberLookupKeys(partNumber)) {
      const specs = partIndex.get(key);
      if (!specs) {
        continue;
      }

      for (const spec of specs) {
        const dedupeKey = [
          spec.make,
          spec.model,
          spec.designation,
          spec.engine,
          spec.year,
          spec.part_number,
          spec.part_column,
        ].join("|");

        if (seen.has(dedupeKey)) {
          continue;
        }

        seen.add(dedupeKey);
        matches.push(spec);
      }
    }
  }

  return matches;
}

export function lookupPartSpecsForText(
  partIndex: Map<string, VehiclePartSpecRow[]>,
  ...sources: Array<string | null | undefined>
): VehiclePartSpecRow[] {
  return lookupPartSpecsForCandidates(partIndex, extractPartNumbers(...sources));
}

export function lookupPartSpecsEnhanced(
  partIndex: Map<string, VehiclePartSpecRow[]>,
  knownPartNumbers: ReadonlySet<string>,
  ...sources: Array<string | null | undefined>
): VehiclePartSpecRow[] {
  return lookupPartSpecsForCandidates(
    partIndex,
    extractPartNumbersEnhanced(knownPartNumbers, ...sources),
  );
}

function enrichRowFromPartMatches(
  row: FitmentAuditRow,
  matches: VehiclePartSpecRow[],
): FitmentAuditRow | null {
  if (matches.length === 0) {
    return null;
  }

  const yearRange = formatYearRangeFromPartMatches(matches);
  if (!yearRange) {
    return null;
  }

  return {
    ...row,
    make: row.make.trim() || joinUniqueValues(matches.map((match) => match.make)),
    models: row.models.trim() || joinUniqueValues(matches.map((match) => match.model)),
    engine_code:
      row.engine_code.trim() || joinUniqueValues(matches.map((match) => match.engine.trim())),
    year_range: yearRange,
  };
}

export function enrichAuditRowByPartNumber(
  row: FitmentAuditRow,
  partIndex: Map<string, VehiclePartSpecRow[]>,
): FitmentAuditRow | null {
  if (row.year_range.trim()) {
    return null;
  }

  const matches = lookupPartSpecsForText(
    partIndex,
    row.product_name,
    row.sku,
    row.current_fitment_text,
  );

  return enrichRowFromPartMatches(row, matches);
}

export function enrichAuditRowByPartNumberEnhanced(
  row: FitmentAuditRow,
  partIndex: Map<string, VehiclePartSpecRow[]>,
  knownPartNumbers: ReadonlySet<string>,
): FitmentAuditRow | null {
  if (row.year_range.trim()) {
    return null;
  }

  const matches = lookupPartSpecsEnhanced(
    partIndex,
    knownPartNumbers,
    row.product_name,
    row.sku,
    row.current_fitment_text,
  );

  return enrichRowFromPartMatches(row, matches);
}

function enrichRowsWithMatcher(
  rows: FitmentAuditRow[],
  matcher: (row: FitmentAuditRow) => FitmentAuditRow | null,
): { rows: FitmentAuditRow[]; filled_count: number } {
  let filledCount = 0;

  const enrichedRows = rows.map((row) => {
    const enriched = matcher(row);
    if (!enriched) {
      return row;
    }

    filledCount += 1;
    return enriched;
  });

  return { rows: enrichedRows, filled_count: filledCount };
}

export function enrichRowsByPartNumber(
  rows: FitmentAuditRow[],
  partIndex: Map<string, VehiclePartSpecRow[]>,
): { rows: FitmentAuditRow[]; filled_count: number } {
  return enrichRowsWithMatcher(rows, (row) => enrichAuditRowByPartNumber(row, partIndex));
}

export function enrichRowsByPartNumberEnhanced(
  rows: FitmentAuditRow[],
  partIndex: Map<string, VehiclePartSpecRow[]>,
  knownPartNumbers: ReadonlySet<string>,
): { rows: FitmentAuditRow[]; filled_count: number } {
  return enrichRowsWithMatcher(rows, (row) =>
    enrichAuditRowByPartNumberEnhanced(row, partIndex, knownPartNumbers),
  );
}

/** Useful for tests and debugging. */
export function matchedPartNumbers(
  partIndex: Map<string, VehiclePartSpecRow[]>,
  ...sources: Array<string | null | undefined>
): string[] {
  return extractPartNumbers(...sources).filter((partNumber) =>
    partNumberLookupKeys(partNumber).some((key) => partIndex.has(key)),
  );
}

export function indexPartNumberCount(partIndex: Map<string, VehiclePartSpecRow[]>): number {
  return new Set(
    [...partIndex.values()].flatMap((specs) =>
      specs.map((spec) => normalizePartNumber(spec.part_number)),
    ),
  ).size;
}
