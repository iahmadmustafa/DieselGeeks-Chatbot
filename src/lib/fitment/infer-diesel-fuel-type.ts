import { normalizeEngine, splitCsvField } from "@/lib/vehicle-lookup/normalize";

/** Diesel engine codes we can infer fuel type from when Engine Code is populated. */
export const KNOWN_DIESEL_ENGINE_CODES = [
  "1KD",
  "1VD",
  "4JJ1",
  "YD25",
  "ZD30",
  "TD42",
  "1HZ",
  "1HD-FTE",
  "P4AT",
  "P5AT",
  "4M41",
  "4N15",
  "DD13",
  "DD15",
  "DD16",
  "4HK1",
  "6HK1",
] as const;

const NORMALIZED_KNOWN_DIESEL_ENGINES = KNOWN_DIESEL_ENGINE_CODES.map((code) =>
  normalizeEngine(code),
);

export function isKnownDieselEngineCode(engineCode: string): boolean {
  const normalized = normalizeEngine(engineCode);
  if (!normalized || normalized.length < 3) {
    return false;
  }

  return NORMALIZED_KNOWN_DIESEL_ENGINES.some(
    (known) =>
      normalized === known || normalized.startsWith(known) || known.startsWith(normalized),
  );
}

export function inferDieselFuelTypeFromEngineCodes(engineCodes: string): string {
  const engines = splitCsvField(engineCodes);
  if (engines.length === 0) {
    return "";
  }

  return engines.some(isKnownDieselEngineCode) ? "Diesel" : "";
}
