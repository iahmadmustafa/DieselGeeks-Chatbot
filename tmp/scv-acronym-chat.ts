async function main() {
  for (const q of ["4JJ1 SCV", "Isuzu 4JJ1 SCV"]) {
    const res = await fetch("https://diesel-geeks-chatbot.vercel.app/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://stage2.dieselgeeks.com.au" },
      body: JSON.stringify({
        id: "scv2",
        sessionId: "scv2-" + Date.now() + Math.random(),
        trigger: "submit-message",
        messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: q }] }],
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
      } catch {}
    }
    console.log("---", q);
    console.log("ids", [...new Set(ids)]);
    console.log(text.slice(0, 350));
    await new Promise(r => setTimeout(r, 5500));
  }
}
main();
