/** Normalize unicode dashes/hyphens to ASCII before part-number parsing. */
export function normalizePartNumberInput(value: string): string {
  return value
    .replace(/[\u2010-\u2015\u2212\u00ad\uFE58\uFE63\uFF0D–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize a part number for index lookup. */
export function normalizePartNumber(value: string): string {
  return normalizePartNumberInput(value)
    .toUpperCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, "")
    .replace(/-+/g, "-")
    .trim();
}

/** Map product/SKU kit codes to spreadsheet part-column values. */
export const PART_NUMBER_ALIASES: Record<string, string> = {
  "1KDE3FLK": "1KD E3 FLK",
  "1KDE4FLK": "1KD E4 FLK",
};

export function isCatalogPartNumber(
  value: string,
  allowedExact: ReadonlySet<string> = new Set(),
): boolean {
  const normalized = normalizePartNumber(value);
  if (!normalized || normalized.length < 3) {
    return false;
  }

  if (allowedExact.has(normalized)) {
    return true;
  }

  if (normalized.length < 5) {
    return false;
  }

  if (/^(NOTAVAILABLE|NA|N\/A|-)$/i.test(normalized)) {
    return false;
  }

  if (/FITTINGKIT|WK4JJ1|4JJ1LATE/i.test(normalized)) {
    return false;
  }

  if (/FLK/i.test(normalized) && !allowedExact.has(normalized)) {
    return false;
  }

  return /\d/.test(normalized);
}

const PART_NUMBER_PATTERNS = [
  /\b(\d{5}-\d{4})\b/gi,
  /\b(\d{5}-\d{5})\b/gi,
  /\b(\d{5}-[A-Z0-9]{3,})\b/gi,
  /\b(\d-\d{5}-\d{5}-\d)\b/gi,
  /\b(\d{4}-\d{3}-\d{3})\b/gi,
  /\b(G\d{6}-\d{4}W)\b/gi,
  /\b([A-Z0-9]{4,}-[A-Z0-9-]+)\b/gi,
  /\b([A-Z]\d[A-Z0-9]{8,})\b/gi,
  /\b([A-Z]{2,3}\d{5,}[A-Z0-9-]*)\b/gi,
  /\b(0\d{9,11})\b/g,
] as const;

const SPACED_BOSCH_PATTERN = /\b(0\s+\d{3}\s+\d{3}\s+\d{3})\b/g;

function addCandidate(
  candidates: Set<string>,
  raw: string,
  allowedExact: ReadonlySet<string>,
): void {
  const normalized = normalizePartNumber(raw);
  if (isCatalogPartNumber(normalized, allowedExact)) {
    candidates.add(normalized);
  }
}

/** Bosch SKUs stored with spaces, e.g. "0 445 110 877" -> "0445110877". */
export function extractSpacedBoschPartNumbers(
  ...sources: Array<string | null | undefined>
): string[] {
  const results = new Set<string>();

  for (const source of sources) {
    if (!source?.trim()) {
      continue;
    }

    SPACED_BOSCH_PATTERN.lastIndex = 0;
    for (const match of source.matchAll(SPACED_BOSCH_PATTERN)) {
      const value = match[1];
      if (value) {
        results.add(normalizePartNumber(value));
      }
    }
  }

  return [...results];
}

function addAliasCandidates(candidates: Set<string>): void {
  for (const candidate of [...candidates]) {
    const alias = PART_NUMBER_ALIASES[candidate];
    if (alias) {
      candidates.add(normalizePartNumber(alias));
    }
  }

  for (const [from, to] of Object.entries(PART_NUMBER_ALIASES)) {
    if (candidates.has(from)) {
      candidates.add(normalizePartNumber(to));
    }
  }
}

function addWholeTokenCandidates(
  candidates: Set<string>,
  allowedExact: ReadonlySet<string>,
  ...sources: Array<string | null | undefined>
): void {
  for (const source of sources) {
    if (!source?.trim()) {
      continue;
    }

    const wholeToken = normalizePartNumber(source);
    addCandidate(candidates, wholeToken, allowedExact);

    const alias = PART_NUMBER_ALIASES[wholeToken];
    if (alias) {
      addCandidate(candidates, alias, allowedExact);
    }
  }
}

export function normalizeAllowedPartNumbers(allowedExact: ReadonlySet<string>): Set<string> {
  return new Set([...allowedExact].map((entry) => normalizePartNumber(entry)));
}

function extractFromSources(
  allowedExact: ReadonlySet<string>,
  normalizeInput: boolean,
  includeBosch: boolean,
  includeAliases: boolean,
  ...sources: Array<string | null | undefined>
): string[] {
  const candidates = new Set<string>();

  for (const source of sources) {
    if (!source?.trim()) {
      continue;
    }

    const parsedSource = normalizeInput ? normalizePartNumberInput(source) : source;

    for (const pattern of PART_NUMBER_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of parsedSource.matchAll(pattern)) {
        const value = match[1];
        if (value) {
          addCandidate(candidates, value, allowedExact);
        }
      }
    }

    if (allowedExact.has(normalizePartNumber(parsedSource))) {
      candidates.add(normalizePartNumber(parsedSource));
    }
  }

  if (includeBosch) {
    for (const boschPart of extractSpacedBoschPartNumbers(...sources)) {
      addCandidate(candidates, boschPart, allowedExact);
    }
  }

  if (includeAliases) {
    addAliasCandidates(candidates);
  }

  return [...candidates];
}

/** Pass 2: regex extraction from product text fields. */
export function extractPartNumbers(
  ...sources: Array<string | null | undefined>
): string[] {
  return extractFromSources(new Set(), false, false, false, ...sources);
}

/** Pass 3: unicode hyphens, kit aliases, spaced Bosch SKUs, spreadsheet kit codes. */
export function extractPartNumbersEnhanced(
  allowedExact: ReadonlySet<string>,
  ...sources: Array<string | null | undefined>
): string[] {
  const normalizedAllowed = normalizeAllowedPartNumbers(allowedExact);
  const candidates = extractFromSources(normalizedAllowed, true, true, false, ...sources);

  const merged = new Set(candidates);
  addWholeTokenCandidates(merged, normalizedAllowed, ...sources);
  addAliasCandidates(merged);

  return [...merged];
}

export function partNumberLookupKeys(partNumber: string): string[] {
  const normalized = normalizePartNumber(partNumber);
  const keys = new Set<string>([normalized]);
  const withoutDashes = normalized.replace(/-/g, "");

  if (withoutDashes !== normalized) {
    keys.add(withoutDashes);
  }

  const alias = PART_NUMBER_ALIASES[normalized];
  if (alias) {
    keys.add(normalizePartNumber(alias));
  }

  return [...keys];
}

/** Collect normalized part values from spreadsheet part columns. */
export function collectSpreadsheetPartNumbers(
  rows: Array<Record<string, unknown>>,
  isPartColumn: (columnName: string) => boolean,
): Set<string> {
  const allowed = new Set<string>();

  for (const row of rows) {
    for (const [columnName, value] of Object.entries(row)) {
      if (!isPartColumn(columnName)) {
        continue;
      }

      const rawPartNumber =
        typeof value === "string"
          ? value.trim()
          : typeof value === "number" && Number.isFinite(value)
            ? String(value)
            : "";

      if (!rawPartNumber || !/\d/.test(rawPartNumber)) {
        continue;
      }

      allowed.add(normalizePartNumber(rawPartNumber));
    }
  }

  for (const aliasTarget of Object.values(PART_NUMBER_ALIASES)) {
    allowed.add(normalizePartNumber(aliasTarget));
  }

  for (const aliasSource of Object.keys(PART_NUMBER_ALIASES)) {
    allowed.add(aliasSource);
  }

  return allowed;
}
