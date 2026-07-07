import type { FitmentParseResult, NormalizedFitment, YearRange } from "@/types/catalog";

const KNOWN_KEYS = new Set([
  "make",
  "models",
  "model",
  "engine code",
  "fuel type",
  "fuel system",
  "year range",
]);

function emptyFitment(): NormalizedFitment {
  return {
    makes: [],
    models: [],
    engine_codes: [],
    fuel_type: null,
    fuel_system: null,
    year_ranges: {},
    notes: null,
  };
}

function splitListValue(value: string): string[] {
  return value
    .split(/[\/,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseYearToken(token: string): number | null {
  const match = token.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function parseYearRangeLine(line: string): { label: string; range: YearRange } | null {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) {
    return null;
  }

  const label = line.slice(0, colonIndex).trim();
  const value = line.slice(colonIndex + 1).trim();

  if (!label || !value) {
    return null;
  }

  const years = value.match(/\b(19|20)\d{2}\b/g);
  if (!years || years.length < 1) {
    return null;
  }

  const from = Number(years[0]);
  const to = Number(years[years.length - 1]);

  if (Number.isNaN(from) || Number.isNaN(to)) {
    return null;
  }

  return { label, range: { from, to } };
}

function extractEngineCode(value: string): { code: string; note: string | null } {
  const trimmed = value.trim();
  const parenMatch = trimmed.match(/^(.+?)\s*\((.+)\)\s*$/);

  if (parenMatch) {
    return {
      code: parenMatch[1].trim(),
      note: parenMatch[2].trim(),
    };
  }

  return { code: trimmed, note: null };
}

function appendNote(existing: string | null, addition: string | null): string | null {
  if (!addition) {
    return existing;
  }
  if (!existing) {
    return addition;
  }
  if (existing.includes(addition)) {
    return existing;
  }
  return `${existing}; ${addition}`;
}

function isKnownKeyLine(line: string): boolean {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) {
    return false;
  }
  const key = line.slice(0, colonIndex).trim().toLowerCase();
  return KNOWN_KEYS.has(key);
}

function looksLikeYearRangeEntry(line: string): boolean {
  return parseYearRangeLine(line) !== null;
}

export function parseFitmentDeterministic(raw: string): FitmentParseResult {
  const trimmed = raw.trim();

  if (!trimmed) {
    return {
      fitment: emptyFitment(),
      method: "empty",
      parseError: "Fitment field is empty",
    };
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const fitment = emptyFitment();
  let inYearRangeSection = false;
  let sawStructuredField = false;
  const unparsedLines: string[] = [];

  for (const line of lines) {
    if (isKnownKeyLine(line)) {
      const colonIndex = line.indexOf(":");
      const key = line.slice(0, colonIndex).trim().toLowerCase();
      const value = line.slice(colonIndex + 1).trim();

      sawStructuredField = true;
      inYearRangeSection = key === "year range";

      if (!value && key !== "year range") {
        unparsedLines.push(line);
        continue;
      }

      switch (key) {
        case "make":
          fitment.makes = splitListValue(value);
          break;
        case "models":
        case "model":
          fitment.models = splitListValue(value);
          break;
        case "engine code": {
          const { code, note } = extractEngineCode(value);
          if (code) {
            fitment.engine_codes = [code];
          }
          fitment.notes = appendNote(fitment.notes, note);
          break;
        }
        case "fuel type":
          fitment.fuel_type = value;
          break;
        case "fuel system":
          fitment.fuel_system = value;
          break;
        case "year range":
          if (value) {
            const inlineRange = parseYearRangeLine(`Vehicle: ${value}`);
            if (inlineRange) {
              fitment.year_ranges[inlineRange.label] = inlineRange.range;
            } else {
              unparsedLines.push(line);
            }
          }
          break;
        default:
          unparsedLines.push(line);
      }

      continue;
    }

    if (inYearRangeSection || looksLikeYearRangeEntry(line)) {
      const parsedRange = parseYearRangeLine(line);
      if (parsedRange) {
        fitment.year_ranges[parsedRange.label] = parsedRange.range;
        sawStructuredField = true;
        inYearRangeSection = true;
        continue;
      }
    }

    unparsedLines.push(line);
  }

  const hasCoreData =
    fitment.makes.length > 0 ||
    fitment.models.length > 0 ||
    fitment.engine_codes.length > 0 ||
    Object.keys(fitment.year_ranges).length > 0;

  if (!sawStructuredField || !hasCoreData) {
    return {
      fitment,
      method: "deterministic",
      parseError: unparsedLines.length
        ? `Could not parse fitment structure: ${unparsedLines.join(" | ")}`
        : "Could not parse fitment structure",
    };
  }

  if (unparsedLines.length > 0) {
    fitment.notes = appendNote(fitment.notes, unparsedLines.join("; "));
  }

  return {
    fitment,
    method: "deterministic",
    parseError: null,
  };
}

export function isDeterministicParseSufficient(result: FitmentParseResult): boolean {
  if (result.method === "empty") {
    return true;
  }

  return result.parseError === null;
}
