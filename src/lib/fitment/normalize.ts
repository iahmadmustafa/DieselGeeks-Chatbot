import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, NoObjectGeneratedError } from "ai";
import { z } from "zod";

import {
  getFitmentLlmModel,
  getFitmentLlmReasoningEffort,
  getOpenAiApiKey,
  readEnv,
} from "@/lib/env/read-env";
import type { FitmentParseResult, NormalizedFitment } from "@/types/catalog";
import {
  isDeterministicParseSufficient,
  parseFitmentDeterministic,
} from "@/lib/fitment/parser";
import {
  createEmptyNormalizedFitment,
  isUnstructuredFitmentMessage,
} from "@/lib/fitment/unstructured";
import { stripHtml } from "@/lib/text/strip-html";

// OpenAI strict structured output: every property must be required; use nullable, not optional/default.
const yearRangeEntrySchema = z.object({
  model: z.string(),
  from: z.number().int().nullable(),
  to: z.number().int().nullable(),
});

const fitmentLlmSchema = z.object({
  makes: z.array(z.string()),
  models: z.array(z.string()),
  engine_codes: z.array(z.string()),
  fuel_type: z.string().nullable(),
  fuel_system: z.string().nullable(),
  year_ranges: z.array(yearRangeEntrySchema),
  notes: z.string().nullable(),
});

function yearRangesToRecord(
  entries: Array<{ model: string; from: number | null; to: number | null }>,
): NormalizedFitment["year_ranges"] {
  const record: NormalizedFitment["year_ranges"] = {};

  for (const entry of entries) {
    const model = entry.model.trim();
    if (!model || entry.from == null || entry.to == null) {
      continue;
    }
    record[model] = { from: entry.from, to: entry.to };
  }

  return record;
}

function buildLlmFitment(
  object: z.infer<typeof fitmentLlmSchema>,
  raw: string,
): NormalizedFitment {
  return {
    makes: object.makes ?? [],
    models: object.models ?? [],
    engine_codes: object.engine_codes ?? [],
    fuel_type: object.fuel_type ?? null,
    fuel_system: object.fuel_system ?? null,
    year_ranges: yearRangesToRecord(object.year_ranges ?? []),
    notes: object.notes?.trim() || raw.trim() || null,
  };
}

function hasCoreFitmentData(fitment: NormalizedFitment): boolean {
  return (
    fitment.makes.length > 0 ||
    fitment.models.length > 0 ||
    fitment.engine_codes.length > 0 ||
    Object.keys(fitment.year_ranges).length > 0
  );
}

function emptyLlmResult(raw: string, parseError: string): FitmentParseResult {
  return {
    fitment: createEmptyNormalizedFitment(raw.trim() || null),
    method: "llm",
    parseError,
  };
}

function logNoObjectGeneratedError(raw: string, error: NoObjectGeneratedError): void {
  console.error("[fitment/llm] NoObjectGeneratedError", {
    message: error.message,
    finishReason: error.finishReason,
    usage: error.usage,
    response: error.response,
    raw_model_text: error.text ?? null,
    fitment_raw_preview: raw.slice(0, 300),
    fitment_raw_length: raw.length,
  });
}

function logLlmFailure(raw: string, error: unknown): void {
  if (NoObjectGeneratedError.isInstance(error)) {
    logNoObjectGeneratedError(raw, error);
    return;
  }

  console.error("[fitment/llm] unexpected error", {
    message: error instanceof Error ? error.message : String(error),
    fitment_raw_preview: raw.slice(0, 300),
    fitment_raw_length: raw.length,
    stack: error instanceof Error ? error.stack : undefined,
  });
}

const FITMENT_LLM_PROMPT = `Parse this diesel parts fitment text into structured JSON.

Rules:
- Split makes on "/" and ",".
- Split models on ",".
- Engine codes should not include parenthetical notes; put notes in "notes".
- Year ranges: return an array of { model, from, to } objects (e.g. { "model": "Isuzu D-Max", "from": 2007, "to": 2016 }). Use null for from/to when a year is unknown.
- Use null for missing scalar fields and empty arrays when a field is not present.
- If the text has no make/model/engine/year data (e.g. "contact us to confirm fitment"), return empty arrays/null fields and put the original message in "notes". Do not invent data.
- Do not invent data not present in the text.`;

function getFitmentLlmMaxOutputTokens(): number {
  const configured = Number(readEnv("FITMENT_LLM_MAX_OUTPUT_TOKENS") ?? "2000");
  return Number.isNaN(configured) ? 2000 : configured;
}

export async function parseFitmentWithLlm(raw: string): Promise<FitmentParseResult> {
  const apiKey = getOpenAiApiKey();

  if (!apiKey) {
    const deterministic = parseFitmentDeterministic(raw);
    return {
      ...deterministic,
      parseError:
        deterministic.parseError ??
        "Deterministic parser failed and OPENAI_API_KEY is not configured for LLM fallback",
    };
  }

  if (isUnstructuredFitmentMessage(raw)) {
    return emptyLlmResult(raw, "No structured fitment data (unstructured text)");
  }

  const openai = createOpenAI({ apiKey });
  const model = getFitmentLlmModel();
  const reasoningEffort = getFitmentLlmReasoningEffort();
  const llmInput = stripHtml(raw);

  try {
    const { object, usage } = await generateObject({
      model: openai(model),
      schema: fitmentLlmSchema,
      maxOutputTokens: getFitmentLlmMaxOutputTokens(),
      providerOptions: {
        openai: {
          reasoningEffort,
          reasoningSummary: null,
        },
      },
      prompt: `${FITMENT_LLM_PROMPT}

Fitment text:
"""
${llmInput}
"""`,
    });

    const fitment = buildLlmFitment(object, raw);

    console.error("[fitment/llm] parse complete", {
      reasoning_effort: reasoningEffort,
      reasoning_tokens: usage.outputTokenDetails?.reasoningTokens ?? null,
      output_tokens: usage.outputTokens ?? null,
      fitment_raw_length: raw.length,
      llm_input_length: llmInput.length,
    });

    return {
      fitment,
      method: "llm",
      parseError: hasCoreFitmentData(fitment)
        ? null
        : "No structured fitment data found",
    };
  } catch (error) {
    logLlmFailure(raw, error);

    if (NoObjectGeneratedError.isInstance(error)) {
      const parseError =
        error.finishReason === "length"
          ? "LLM token budget exhausted during reasoning (finishReason: length)"
          : "No structured fitment data (model returned no parseable object)";

      return emptyLlmResult(raw, parseError);
    }

    const message = error instanceof Error ? error.message : "Unknown LLM parse error";
    return emptyLlmResult(raw, `LLM fallback failed: ${message}`);
  }
}

export async function normalizeFitment(raw: string): Promise<FitmentParseResult> {
  const deterministic = parseFitmentDeterministic(raw);

  if (isDeterministicParseSufficient(deterministic)) {
    return deterministic;
  }

  return parseFitmentWithLlm(raw);
}
