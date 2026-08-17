/**
 * Smoke-test Braintrust logging with local .env.local credentials.
 * Usage: npx tsx scripts/braintrust-smoke.ts
 */
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { flush, initLogger, traced } from "braintrust";

import { loadEnvLocal } from "../src/lib/env/load-env-local";

loadEnvLocal();

async function main(): Promise<void> {
  const apiKey = process.env.BRAINTRUST_API_KEY?.trim();
  const projectName = process.env.BRAINTRUST_PROJECT?.trim() || "dieselgeeks-chat";
  const openAiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("BRAINTRUST_API_KEY missing in .env.local");
  }
  if (!openAiKey) {
    throw new Error("OPENAI_API_KEY missing in .env.local");
  }

  initLogger({ projectName, apiKey });
  console.log("logging smoke span to project", projectName);

  await traced(
    async (span) => {
      span.log({
        input: "braintrust smoke test",
        metadata: { source: "scripts/braintrust-smoke.ts" },
      });

      const openai = createOpenAI({ apiKey: openAiKey });
      const result = await generateText({
        model: openai("gpt-4.1-mini"),
        prompt: "Reply with exactly: braintrust-ok",
      });

      span.log({ output: result.text });
      console.log("model said:", result.text);
    },
    { name: "braintrust-smoke", type: "function" },
  );

  await flush();
  console.log("flushed — check https://www.braintrust.dev/app/dieselgeeks/p/dieselgeeks-chat/logs");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
