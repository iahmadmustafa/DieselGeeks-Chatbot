export type ParseFailureCategory =
  | "no_data_available"
  | "token_or_reasoning_limit"
  | "llm_error"
  | "deterministic_error"
  | "other";

const NO_DATA_PATTERNS = [
  /^no structured fitment data/i,
  /^fitment field is empty/i,
  /^could not parse fitment structure/i,
];

const TOKEN_LIMIT_PATTERNS = [
  /token budget exhausted/i,
  /finishReason:\s*length/i,
  /model returned no parseable object/i,
  /no object generated/i,
];

export function classifyParseFailure(
  parseError: string,
  fitmentRaw: string,
): ParseFailureCategory {
  if (TOKEN_LIMIT_PATTERNS.some((pattern) => pattern.test(parseError))) {
    return "token_or_reasoning_limit";
  }

  if (NO_DATA_PATTERNS.some((pattern) => pattern.test(parseError))) {
    return "no_data_available";
  }

  if (/^llm fallback failed:/i.test(parseError)) {
    return "llm_error";
  }

  if (parseError.toLowerCase().includes("could not parse")) {
    return "deterministic_error";
  }

  const normalizedRaw = fitmentRaw.trim().toLowerCase();
  if (
    /contact us|confirm fitment|please contact|call us|enquire|enquiry|get in touch/.test(
      normalizedRaw,
    )
  ) {
    return "no_data_available";
  }

  return "other";
}

export function isExpectedParseFailure(category: ParseFailureCategory): boolean {
  return category === "no_data_available";
}
