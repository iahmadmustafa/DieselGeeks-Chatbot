/**
 * Optional Braintrust tracing for chat (AI SDK v7).
 * No-op when BRAINTRUST_API_KEY is unset — local/dev without Braintrust still works.
 *
 * Vercel: set BRAINTRUST_API_KEY (and optional BRAINTRUST_PROJECT) then redeploy.
 * After deploy, open Braintrust Logs and send a stage2 chat to confirm traces.
 */
import * as ai from "ai";
import { braintrustAISDKTelemetry, initLogger, traced } from "braintrust";

import { getBraintrustApiKey, getBraintrustProject } from "@/lib/env/read-env";

let telemetryReady = false;

/** Init logger + AI SDK telemetry once per process when an API key is configured. */
export function ensureBraintrustTelemetry(): void {
  if (telemetryReady) {
    return;
  }
  telemetryReady = true;

  const apiKey = getBraintrustApiKey();
  if (!apiKey) {
    return;
  }

  initLogger({
    projectName: getBraintrustProject(),
    apiKey,
  });
  ai.registerTelemetry(braintrustAISDKTelemetry());
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
  },
  fn: () => Promise<T>,
): Promise<T> {
  ensureBraintrustTelemetry();

  if (!isBraintrustEnabled()) {
    return fn();
  }

  return traced(
    async (span) => {
      span.log({
        metadata: {
          sessionId: metadata.sessionId,
          wpUserId: metadata.wpUserId,
          isLoggedIn: metadata.isLoggedIn,
        },
      });
      return fn();
    },
    { name: "dieselgeeks-chat-turn", type: "function" },
  );
}

/** Prefer this over importing streamText from `ai` directly so telemetry stays consistent. */
export const streamText = ai.streamText;
