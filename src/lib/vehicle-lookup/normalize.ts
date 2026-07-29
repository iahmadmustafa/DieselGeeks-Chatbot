/** Lowercase alphanumeric token for fuzzy comparisons. */
export function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeMake(value: string): string {
  return normalizeToken(value);
}

/** Strip make prefix and punctuation from a model name. */
export function normalizeModel(value: string): string {
  const stripped = value
    .replace(/^(toyota|nissan|isuzu|ford|mazda|holden|mitsubishi)\s+/i, "")
    .trim();
  return normalizeToken(stripped);
}

/** Collapse common engine suffix variants (1KD-FTV → 1kd, ZD30DDTi → zd30). */
export function normalizeEngine(value: string): string {
  let token = normalizeToken(value);
  token = token.replace(/ftv$/, "");
  token = token.replace(/ddti$/, "");
  token = token.replace(/crd$/, "");
  return token;
}

export function splitCsvField(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of value) {
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
    }

    if (char === "," && depth === 0) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

export function parseYear(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const year = Math.trunc(value);
    return year >= 1970 && year <= 2100 ? year : null;
  }

  if (typeof value === "string") {
    const match = value.match(/\b(19|20)\d{2}\b/);
    if (match) {
      return Number.parseInt(match[0], 10);
    }
  }

  return null;
}

export function enginesMatch(productEngine: string, specEngine: string): boolean {
  const left = normalizeEngine(productEngine);
  const right = normalizeEngine(specEngine);

  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  const minLength = Math.min(left.length, right.length);
  if (minLength < 3) {
    return false;
  }

  return left.startsWith(right) || right.startsWith(left);
}

function extractSeriesNumbers(model: string): string[] {
  return [...model.matchAll(/\b(\d{2,3})\s*(?:series)?\b/gi)].map((match) => match[1] ?? "");
}

export function modelsMatch(productModel: string, specModel: string, specDesignation: string): boolean {
  const product = normalizeModel(productModel);
  const spec = normalizeModel(specModel);
  const designation = normalizeToken(String(specDesignation));

  if (!product || !spec) {
    return false;
  }

  // LandCruiser series must align when the product names a series.
  if (product.includes("landcruiser") && spec.includes("landcruiser")) {
    const productSeries = extractSeriesNumbers(productModel);
    const specSeries = [
      ...extractSeriesNumbers(specModel),
      ...extractSeriesNumbers(String(specDesignation)),
    ];

    if (productSeries.length > 0) {
      if (specSeries.length === 0) {
        return false;
      }

      return productSeries.some((series) => specSeries.includes(series));
    }

    return true;
  }

  // Navara generations (D22 vs D40) must not cross-match.
  if (spec.includes("navara") && product.includes("navara")) {
    const productHasD40 = product.includes("d40");
    const productHasD22 = product.includes("d22");
    const specHasD40 = spec.includes("d40") || designation.includes("d40");
    const specHasD22 = spec.includes("d22") || designation.includes("d22");

    if (productHasD40) {
      return specHasD40;
    }
    if (productHasD22) {
      return specHasD22;
    }

    return specHasD40 || specHasD22;
  }

  if (product === spec || product.includes(spec) || spec.includes(product)) {
    return true;
  }

  // D-Max / MU-X rows are stored as "DMAX or MUX".
  if (spec.includes("dmax") && product.includes("dmax")) {
    return true;
  }
  if (spec.includes("mux") && product.includes("mux")) {
    return true;
  }

  // Ranger / BT-50 share the same PX engine rows in the Ford spreadsheet.
  if (
    (product.includes("ranger") || product.includes("bt50")) &&
    (spec.includes("ranger") || spec.includes("bt50"))
  ) {
    return true;
  }

  // Hilux / Prado rows in the Hilux spreadsheet.
  if (spec === "hilux" && product.includes("hilux")) {
    return true;
  }
  if (spec === "prado" && product.includes("prado")) {
    return true;
  }

  // Patrol rows.
  if (spec.includes("patrol") && product.includes("patrol")) {
    return true;
  }

  // Holden Colorado (4JJ1) shares Isuzu D-Max platform years.
  if (product.includes("colorado") && spec.includes("dmax")) {
    return true;
  }

  return false;
}

export function makesMatch(productMake: string, specMake: string): boolean {
  const left = normalizeMake(productMake);
  const right = normalizeMake(specMake);

  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  // BT-50 fitment uses Ford Ranger engine-year data.
  if (left === "mazda" && right === "ford") {
    return true;
  }

  // Holden Colorado RG shares Isuzu 4JJ1 data.
  if (left === "holden" && right === "isuzu") {
    return true;
  }

  return false;
}
