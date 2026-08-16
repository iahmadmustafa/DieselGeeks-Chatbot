async function main() {
  const res = await fetch("https://diesel-geeks-chatbot.vercel.app/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://stage2.dieselgeeks.com.au" },
    body: JSON.stringify({
      id: "scv-chat",
      sessionId: "scv-" + Date.now(),
      trigger: "submit-message",
      messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: "Do you have a suction control valve for Isuzu 4JJ1?" }] }],
    }),
  });
  const raw = await res.text();
  let text = "";
  const ids = [];
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const e = JSON.parse(payload);
      if (e.type === "text-delta") text += e.delta || "";
      if (e.type === "tool-output-available" && e.output?.products) {
        for (const p of e.output.products) if (p.id) ids.push(p.id);
      }
      if (e.type === "data-products" && Array.isArray(e.data)) {
        for (const p of e.data) if (p.id) ids.push(p.id);
      }
    } catch {}
  }
  console.log("CHAT_SCV ids", [...new Set(ids)]);
  console.log("CHAT_SCV text", text.slice(0, 600));
}
main();
