/** Strip HTML tags and normalize whitespace for fitment parsing prompts. */
export function stripHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const FITMENT_LABEL_PATTERN =
  "Make|Models?|Engine Codes?|Engine Code|Engine Type|Fuel Type|Fuel System|Year Range";

/** Convert HTML fitment (lists, bold labels) into plain Key: value lines for the deterministic parser. */
export function fitmentRawToPlainText(raw: string): string {
  const labelWithColonPattern = new RegExp(
    `<(?:b|strong)\\s*>\\s*(${FITMENT_LABEL_PATTERN})\\s*:\\s*<\\/(?:b|strong)\\s*>`,
    "gi",
  );
  const labelOnlyPattern = new RegExp(
    `<(?:b|strong)\\s*>\\s*(${FITMENT_LABEL_PATTERN})\\s*<\\/(?:b|strong)\\s*>`,
    "gi",
  );

  const text = raw
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(labelWithColonPattern, "\n$1:")
    .replace(labelOnlyPattern, "\n$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/^['"]+/, "")
    .trim();

  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
