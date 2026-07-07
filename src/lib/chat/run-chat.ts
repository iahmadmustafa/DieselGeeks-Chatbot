import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
} from "ai";

import { previewText, trimChatHistory } from "@/lib/chat/guardrails";
import { extractCatalogScope } from "@/lib/catalog/scope";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import {
  createChatTools,
  mergeProductCards,
} from "@/lib/chat/tools";
import {
  getChatMaxOutputTokens,
  getChatModel,
  getOpenAiApiKey,
} from "@/lib/env/read-env";
import { appendConversationLog } from "@/lib/redis/conversation-log";
import { getSnapshot } from "@/lib/redis/snapshot";
import type {
  ChatUIMessage,
  ConversationSearchCall,
  ProductCard,
} from "@/types/chat";

function createChatModel() {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for chat");
  }

  const openai = createOpenAI({ apiKey });
  return openai(getChatModel());
}

export async function runChat(options: {
  messages: ChatUIMessage[];
  sessionId: string;
}): Promise<ReadableStream> {
  const snapshot = await getSnapshot();
  if (!snapshot) {
    throw new Error("Catalog snapshot is not available. Run /api/sync first.");
  }

  const trimmedMessages = trimChatHistory(options.messages);
  const catalogScope = extractCatalogScope(snapshot.products);
  const collectedProducts: ProductCard[] = [];
  const searchCalls: ConversationSearchCall[] = [];
  let assistantText = "";

  const tools = createChatTools(snapshot, {
    onSearchComplete: (result, args) => {
      searchCalls.push({
        args,
        match_type: result.match_type,
        result_count: result.result_count,
      });
      const merged = mergeProductCards(collectedProducts, result.products);
      collectedProducts.length = 0;
      collectedProducts.push(...merged);
    },
  });

  const stream = createUIMessageStream<ChatUIMessage>({
    originalMessages: trimmedMessages as ChatUIMessage[],
    execute: async ({ writer }) => {
      const result = streamText({
        model: createChatModel(),
        system: buildSystemPrompt(catalogScope),
        messages: await convertToModelMessages(trimmedMessages, { tools }),
        tools,
        stopWhen: stepCountIs(5),
        maxOutputTokens: getChatMaxOutputTokens(),
        providerOptions: {
          openai: {
            reasoningEffort: "low",
            reasoningSummary: null,
          },
        },
        onStepEnd: ({ text }) => {
          if (text) {
            assistantText += text;
          }
        },
      });

      writer.merge(result.toUIMessageStream());
      await result.consumeStream();

      if (collectedProducts.length > 0) {
        writer.write({
          type: "data-products",
          data: collectedProducts,
        });
      }
    },
    onEnd: async () => {
      const userPreview = previewText(
        trimmedMessages
          .filter((message) => message.role === "user")
          .map((message) =>
            message.parts
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join(""),
          )
          .at(-1) ?? "",
      );

      await appendConversationLog({
        session_id: options.sessionId,
        timestamp: new Date().toISOString(),
        user_message_preview: userPreview,
        search_calls: searchCalls,
        lookup_hits: 0,
        lookup_misses: searchCalls.length,
        assistant_text_preview: previewText(assistantText),
      });
    },
  });

  return stream;
}

export async function createChatResponse(options: {
  messages: ChatUIMessage[];
  sessionId: string;
  headers?: HeadersInit;
}): Promise<Response> {
  const stream = await runChat(options);
  return createUIMessageStreamResponse({
    stream,
    headers: options.headers,
  });
}
