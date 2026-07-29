import type { VehiclePartSpecRow, YearRangeSpan } from "./types";

export function joinUniqueValues(values: string[]): string {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    ordered.push(trimmed);
  }

  return ordered.join(", ");
}

export function formatYearRangeLabel(make: string, model: string): string {
  const cleanModel = model
    .replace(/^(toyota|nissan|isuzu|ford|mazda|holden|mitsubishi)\s+/i, "")
    .trim();
  return `${make.trim()} ${cleanModel}`.replace(/\s+/g, " ").trim();
}

function formatYearRangeSpans(spans: YearRangeSpan[]): string {
  if (spans.length === 0) {
    return "";
  }

  const from = Math.min(...spans.map((span) => span.from));
  const to = Math.max(...spans.map((span) => span.to));
  return `${from}–${to}`;
}

export function formatYearRangeFromPartMatches(matches: VehiclePartSpecRow[]): string {
  const groups = new Map<
    string,
    { make: string; model: string; years: number[] }
  >();

  for (const match of matches) {
    const key = `${match.make}|${match.model}`;
    const group = groups.get(key) ?? {
      make: match.make.trim(),
      model: match.model.trim(),
      years: [],
    };
    group.years.push(match.year);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => {
      const span = formatYearRangeSpans([
        { from: Math.min(...group.years), to: Math.max(...group.years) },
      ]);
      return `${formatYearRangeLabel(group.make, group.model)}: ${span}`;
    })
    .join("; ");
}
