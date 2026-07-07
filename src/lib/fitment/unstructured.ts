import type { NormalizedFitment } from "@/types/catalog";

export function createEmptyNormalizedFitment(notes: string | null = null): NormalizedFitment {
  return {
    makes: [],
    models: [],
    engine_codes: [],
    fuel_type: null,
    fuel_system: null,
    year_ranges: {},
    notes,
  };
}

/** Skip LLM when fitment is clearly free-text with no structured Key: value lines. */
export function isUnstructuredFitmentMessage(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return true;
  }

  const hasStructuredKeys = /^(make|models?|engine code|fuel type|fuel system|year range):/im.test(
    trimmed,
  );
  if (hasStructuredKeys) {
    return false;
  }

  const normalized = trimmed.toLowerCase();
  const unstructuredPatterns = [
    /contact us/,
    /confirm fitment/,
    /please contact/,
    /call us/,
    /enquire/,
    /enquiry/,
    /get in touch/,
  ];

  return unstructuredPatterns.some((pattern) => pattern.test(normalized));
}
