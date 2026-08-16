import { readUIMessageStream } from "ai";

import { loadEnvLocal } from "../src/lib/env/load-env-local";

loadEnvLocal();

async function main(): Promise<void> {
  const res = await fetch("https://diesel-geeks-chatbot.vercel.app/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://stage2.dieselgeeks.com.au",
    },
    body: JSON.stringify({
      id: "eval-debug2",
      sessionId: `debug2-${Date.now()}`,
      trigger: "submit-message",
      messages: [
        {
          id: "u1",
          role: "user",
          parts: [{ type: "text", text: "What is your phone number?" }],
        },
      ],
    }),
  });

  console.log("status", res.status);
  if (!res.body) {
    console.log("no body", await res.text());
    return;
  }

  let count = 0;
  let last: unknown = null;
  for await (const message of readUIMessageStream({ stream: res.body })) {
    count += 1;
    last = message;
  }
  console.log("message updates", count);
  console.log(JSON.stringify(last, null, 2).slice(0, 3000));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
