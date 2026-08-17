/**
 * Optional Braintrust tracing for chat (AI SDK).
 * No-op when BRAINTRUST_API_KEY is unset — local/dev without Braintrust still works.
 *
 * Vercel checklist:
 * 1. BRAINTRUST_API_KEY (+ optional BRAINTRUST_PROJECT=dieselgeeks-chat) on Production
 * 2. Redeploy after adding env vars (env alone does not restart old deploys)
 * 3. Send a chat on stage2, then open Braintrust Logs (live range)
 */
import * as ai from "ai";
import { flush, initLogger, traced, wrapAISDK } from "braintrust";

import { getBraintrustApiKey, getBraintrustProject } from "@/lib/env/read-env";

type StreamText = typeof ai.streamText;

let ready = false;
let wrappedStreamText: StreamText = ai.streamText;

function ensureBraintrust(): boolean {
  if (ready) {
    return isBraintrustEnabled();
  }
  ready = true;

  const apiKey = getBraintrustApiKey();
  if (!apiKey) {
    console.info("[braintrust] disabled (no BRAINTRUST_API_KEY)");
    return false;
  }

  const projectName = getBraintrustProject();
  initLogger({
    projectName,
    apiKey,
  });

  // wrapAISDK is the reliable path for streamText + tools (plan v1).
  const wrapped = wrapAISDK(ai);
  wrappedStreamText = wrapped.streamText;

  console.info("[braintrust] enabled", { projectName });
  return true;
}

export function isBraintrustEnabled(): boolean {
  return Boolean(getBraintrustApiKey());
}

/**
 * Run a chat turn inside a Braintrust parent span (session / identity metadata).
 * Falls through with no span when Braintrust is not configured.
 */
export async function withChatTrace<T>(
  metadata: {
    sessionId: string;
    wpUserId: number | null;
    isLoggedIn: boolean;
    userMessagePreview: string;
  },
  fn: () => Promise<T>,
): Promise<T> {
  if (!ensureBraintrust()) {
    return fn();
  }

  try {
    return await traced(
      async (span) => {
        span.log({
          input: metadata.userMessagePreview,
          metadata: {
            sessionId: metadata.sessionId,
            wpUserId: metadata.wpUserId,
            isLoggedIn: metadata.isLoggedIn,
          },
        });

        const result = await fn();

        span.log({
          output:
            typeof result === "string"
              ? result
              : { status: "streamed", sessionId: metadata.sessionId },
        });

        return result;
      },
      { name: "dieselgeeks-chat-turn", type: "function" },
    );
  } finally {
    // Serverless: ensure the turn is pushed before the isolate freezes.
    try {
      await flush();
    } catch (error) {
      console.error("[braintrust] flush failed", error);
    }
  }
}

/** Instrumented streamText when Braintrust is configured; otherwise plain AI SDK. */
export function streamText(
  ...args: Parameters<StreamText>
): ReturnType<StreamText> {
  ensureBraintrust();
  return wrappedStreamText(...args);
}
