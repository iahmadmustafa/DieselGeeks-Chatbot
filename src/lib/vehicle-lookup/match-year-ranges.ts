import type { FitmentAuditRow } from "@/lib/fitment/audit";

import {
  enginesMatch,
  makesMatch,
  modelsMatch,
  normalizeModel,
  splitCsvField,
} from "./normalize";
import { formatYearRangeLabel } from "./format-enrichment";
import type { VehicleSpecRow, YearRangeSpan } from "./types";

/** Expand "LandCruiser 70 Series, 200 Series" into fully-qualified model names. */
function expandModelNames(models: string[]): string[] {
  let currentPrefix = "";

  return models.map((model) => {
    const trimmed = model.trim();
    const seriesOnly = /^\d{2,3}\s*series$/i.test(trimmed);

    if (seriesOnly && currentPrefix) {
      return `${currentPrefix} ${trimmed}`;
    }

    const prefixMatch = trimmed.match(/^(.+?\s+\d{2,3})\s+series$/i);
    if (prefixMatch?.[1]) {
      currentPrefix = prefixMatch[1].replace(/\s+\d{2,3}$/i, "").trim();
    } else {
      const makeStripped = trimmed.replace(
        /^(toyota|nissan|isuzu|ford|mazda|holden|mitsubishi)\s+/i,
        "",
      );
      const baseMatch = makeStripped.match(/^([A-Za-z-]+(?:\s+[A-Za-z-]+)*)/);
      currentPrefix = baseMatch?.[1]?.trim() ?? "";
    }

    return trimmed;
  });
}

function formatYearRangeSpans(spans: YearRangeSpan[]): string {
  if (spans.length === 0) {
    return "";
  }

  const from = Math.min(...spans.map((span) => span.from));
  const to = Math.max(...spans.map((span) => span.to));
  return `${from}–${to}`;
}

/** Pair makes with models when products list multiple of each. */
export function expandMakeModelPairs(
  makes: string[],
  models: string[],
): Array<{ make: string; model: string }> {
  if (models.length === 0) {
    return [];
  }

  if (makes.length <= 1) {
    const make = makes[0] ?? "";
    return models.map((model) => ({ make, model }));
  }

  const pairs: Array<{ make: string; model: string }> = [];

  for (const model of models) {
    const normalized = normalizeModel(model);

    if (normalized.includes("colorado")) {
      pairs.push({ make: "Holden", model });
      continue;
    }

    if (normalized.includes("bt50")) {
      pairs.push({ make: "Mazda", model });
      continue;
    }

    if (normalized.includes("ranger")) {
      pairs.push({ make: "Ford", model });
      continue;
    }

    if (normalized.includes("dmax") || normalized.includes("mux")) {
      pairs.push({ make: "Isuzu", model });
      continue;
    }

    for (const make of makes) {
      pairs.push({ make, model });
    }
  }

  return pairs;
}

function findMatchingYears(
  make: string,
  model: string,
  engineCode: string,
  specs: VehicleSpecRow[],
): YearRangeSpan[] {
  const years: number[] = [];

  for (const spec of specs) {
    if (!makesMatch(make, spec.make)) {
      continue;
    }

    if (!modelsMatch(model, spec.model, spec.designation)) {
      continue;
    }

    if (!enginesMatch(engineCode, spec.engine)) {
      continue;
    }

    years.push(spec.year);
  }

  if (years.length === 0) {
    return [];
  }

  return [{ from: Math.min(...years), to: Math.max(...years) }];
}

export function lookupYearRangesForAuditRow(
  row: Pick<FitmentAuditRow, "make" | "models" | "engine_code">,
  specs: VehicleSpecRow[],
): string {
  const makes = splitCsvField(row.make);
  const models = expandModelNames(splitCsvField(row.models));
  const engines = splitCsvField(row.engine_code);

  if (models.length === 0 || engines.length === 0) {
    return "";
  }

  const pairs = expandMakeModelPairs(makes, models);
  const labels: string[] = [];

  for (const { make, model } of pairs) {
    const spans: YearRangeSpan[] = [];

    for (const engineCode of engines) {
      spans.push(...findMatchingYears(make, model, engineCode, specs));
    }

    if (spans.length === 0) {
      continue;
    }

    const label = formatYearRangeLabel(make, model);
    const range = formatYearRangeSpans(spans);
    labels.push(`${label}: ${range}`);
  }

  return labels.join("; ");
}

export function enrichMissingYearRangeRows(
  rows: FitmentAuditRow[],
  specs: VehicleSpecRow[],
): FitmentAuditRow[] {
  return rows.map((row) => {
    if (row.issue_type !== "Missing Year Range" || row.year_range.trim()) {
      return row;
    }

    const suggested = lookupYearRangesForAuditRow(row, specs);
    if (!suggested) {
      return row;
    }

    return {
      ...row,
      year_range: suggested,
    };
  });
}
