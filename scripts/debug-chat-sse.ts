async function main(): Promise<void> {
  const res = await fetch("https://diesel-geeks-chatbot.vercel.app/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://stage2.dieselgeeks.com.au",
    },
    body: JSON.stringify({
      id: "eval-debug3",
      sessionId: `debug3-${Date.now()}`,
      trigger: "submit-message",
      messages: [
        {
          id: "u1",
          role: "user",
          parts: [{ type: "text", text: "4JJ1 injectors for a 2010 Isuzu D-Max" }],
        },
      ],
    }),
  });

  console.log("status", res.status);
  const raw = await res.text();
  const lines = raw.split("\n").filter((line) => line.startsWith("data: "));
  const types = new Map<string, number>();
  let text = "";
  const productIds: number[] = [];

  for (const line of lines) {
    const payload = line.slice(6).trim();
    if (!payload || payload === "[DONE]") {
      continue;
    }
    try {
      const event = JSON.parse(payload) as {
        type?: string;
        delta?: string;
        text?: string;
        output?: { products?: Array<{ id?: number; title?: string; price?: string }> };
      };
      const type = event.type ?? "unknown";
      types.set(type, (types.get(type) ?? 0) + 1);
      if (type === "text-delta" && event.delta) {
        text += event.delta;
      }
      if (type === "text" && event.text) {
        text += event.text;
      }
      if (type?.includes("tool") && event.output?.products) {
        for (const product of event.output.products) {
          if (typeof product.id === "number") {
            productIds.push(product.id);
          }
        }
      }
    } catch {
      // ignore non-json
    }
  }

  console.log("event types", Object.fromEntries(types));
  console.log("productIds", [...new Set(productIds)]);
  console.log("text", text.slice(0, 800));
  console.log("raw length", raw.length);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
