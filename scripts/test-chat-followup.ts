import { readUIMessageStream } from "ai";

async function postChat(messages: unknown[], sessionId: string): Promise<Response> {
  return fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
    },
    body: JSON.stringify({
      id: "followup-test",
      messages,
      sessionId,
      trigger: "submit-message",
    }),
  });
}

async function main(): Promise<void> {
  const sessionId = `followup-${Date.now()}`;

  const first = await postChat(
    [
      {
        role: "user",
        parts: [{ type: "text", text: "4JJ1 injectors for a 2010 Isuzu D-Max" }],
      },
    ],
    sessionId,
  );

  console.log("first status", first.status);
  if (!first.ok || !first.body) {
    console.log("first error", await first.text());
    process.exit(1);
  }

  let lastMessage: { role?: string; parts?: Array<{ type: string }> } | null = null;

  for await (const message of readUIMessageStream({
    stream: first.body,
  })) {
    lastMessage = message;
  }

  if (!lastMessage || lastMessage.role !== "assistant") {
    console.log("no assistant message in first response", lastMessage);
    process.exit(1);
  }

  const firstMessages = lastMessage;

  console.log("first assistant parts", firstMessages.parts.map((p) => p.type));

  const history = [
    {
      id: "user-1",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "4JJ1 injectors for a 2010 Isuzu D-Max" }],
    },
    firstMessages,
  ];

  const second = await postChat(
    [
      ...history,
      {
        role: "user",
        parts: [{ type: "text", text: "Which one is the full injector set?" }],
      },
    ],
    sessionId,
  );

  console.log("second status", second.status);
  if (!second.ok) {
    console.log("second error body", await second.text());
    process.exit(1);
  }

  console.log("second OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
