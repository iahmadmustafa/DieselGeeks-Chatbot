import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function cleanEnvValue(value: string): string {
  let cleaned = value.replace(/^\uFEFF/, "").trim();

  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned;
}

/** Read a single variable directly from .env.local (bypasses process.env precedence). */
export function readEnvLocalValue(name: string): string | null {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return null;
  }

  const content = readFileSync(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    if (key !== name) {
      continue;
    }

    const value = cleanEnvValue(trimmed.slice(equalsIndex + 1));
    return value || null;
  }

  return null;
}

/** Load .env.local into process.env for standalone scripts (tsx, etc.). */
export function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  const content = readFileSync(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = cleanEnvValue(trimmed.slice(equalsIndex + 1));
    process.env[key] = value;
  }
}
