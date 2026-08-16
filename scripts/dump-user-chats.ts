/**
 * One-off: dump logged-in chat history for a WP user id from Redis.
 * Usage: npx tsx scripts/dump-user-chats.ts 1
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { loadEnvLocal } from "../src/lib/env/load-env-local";
import { getConversation, listConversations } from "../src/lib/redis/chat-history";

loadEnvLocal();

function extractText(parts: unknown[]): string {
  const chunks: string[] = [];
  for (const part of parts) {
    if (
      part &&
      typeof part === "object" &&
      "type" in part &&
      (part as { type: string }).type === "text" &&
      "text" in part &&
      typeof (part as { text: unknown }).text === "string"
    ) {
      chunks.push((part as { text: string }).text);
    }
  }
  return chunks.join("\n").trim();
}

async function main(): Promise<void> {
  const wpUserId = Number(process.argv[2] ?? "1");
  if (!Number.isFinite(wpUserId) || wpUserId <= 0) {
    throw new Error("Pass a positive WP user id, e.g. npx tsx scripts/dump-user-chats.ts 1");
  }

  const summaries = await listConversations(wpUserId);
  console.log(`wpUserId=${wpUserId} conversations=${summaries.length}`);

  const dump = [];
  for (const summary of summaries) {
    const record = await getConversation(wpUserId, summary.id);
    if (!record) {
      continue;
    }
    dump.push({
      id: record.id,
      title: record.title,
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
      messages: record.messages.map((message) => ({
        id: message.id,
        role: message.role,
        text: extractText(message.parts as unknown[]),
        partTypes: (message.parts as unknown[]).map((part) =>
          part && typeof part === "object" && "type" in part
            ? String((part as { type: unknown }).type)
            : typeof part,
        ),
      })),
    });
  }

  const outPath = resolve(process.cwd(), `tmp-matt-chats-user-${wpUserId}.json`);
  writeFileSync(outPath, JSON.stringify(dump, null, 2), "utf8");
  console.log(`wrote ${outPath}`);

  for (const conv of dump) {
    console.log("\n---", conv.title, `(${conv.updatedAt})`);
    for (const message of conv.messages) {
      const preview = message.text.replace(/\s+/g, " ").slice(0, 180);
      console.log(`[${message.role}] ${preview || `(parts: ${message.partTypes.join(",")})`}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
