const NON_FITMENT_CATEGORY_PATTERNS = [
  /\bapparel\b/i,
  /\bclothing\b/i,
  /\bmerch(?:andise)?\b/i,
  /\bt-?shirts?\b/i,
  /\bgifts?\b/i,
];

const NON_FITMENT_TITLE_PATTERNS = [
  /\bt-?shirts?\b/i,
  /\bparody\b/i,
  /\bxmas\s+special\b/i,
  /\binjector\s+bundle\b/i,
  /\bbundle\b.*\bxmas\b/i,
  /\bxmas\b.*\bbundle\b/i,
];

/**
 * True for vehicle parts where fitment data is expected (injectors, lines, valves, etc.).
 * False for merch, apparel, and promotional gift bundles with no vehicle compatibility.
 */
export function isFitmentExpected(title: string, categories: string[]): boolean {
  const normalizedTitle = title.trim();
  const categoryText = categories.join(" ");

  if (NON_FITMENT_CATEGORY_PATTERNS.some((pattern) => pattern.test(categoryText))) {
    return false;
  }

  if (NON_FITMENT_TITLE_PATTERNS.some((pattern) => pattern.test(normalizedTitle))) {
    return false;
  }

  return true;
}

export type FitmentAttentionAction = "Empty" | "Reformat" | "Add content";

function hasHtmlVehicleFitment(text: string): boolean {
  return (
    /<ul|<li|<strong/i.test(text) &&
    /fits|compatible with|engine|series|diesel|mux|d-max|ranger|hilux|patrol|isuzu|toyota|nissan|ford|mazda/i.test(
      text,
    )
  );
}

function isContactOnlyPlaceholder(text: string): boolean {
  const hasContactCue = /please contact|contact us|contact-us|for fitment information/i.test(text);
  return hasContactCue && !hasHtmlVehicleFitment(text);
}

export function classifyFitmentAttention(
  fitmentRaw: string,
  parseError: string | null,
): FitmentAttentionAction {
  const trimmed = fitmentRaw.trim();

  if (!trimmed || parseError === "Fitment field is empty") {
    return "Empty";
  }

  if (hasHtmlVehicleFitment(trimmed)) {
    return "Reformat";
  }

  if (isContactOnlyPlaceholder(trimmed)) {
    return "Add content";
  }

  if (parseError?.toLowerCase().includes("no structured fitment data")) {
    return "Add content";
  }

  return "Reformat";
}
