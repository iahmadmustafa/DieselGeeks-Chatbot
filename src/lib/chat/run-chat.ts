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
import { recordChatSpend } from "@/lib/chat/budget";
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
  let snapshot;
  try {
    snapshot = await getSnapshot();
  } catch (error) {
    console.error("[run-chat] snapshot read failed", error);
    throw new Error("Catalog snapshot is temporarily unavailable");
  }

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

  const stream = createUIMessageStream<ChatUIMessage>({
    originalMessages: trimmedMessages as ChatUIMessage[],
    onError: (error) => {
      console.error("[run-chat] stream error", error);
      return error instanceof Error ? error.message : "Chat stream failed";
    },
    execute: async ({ writer }) => {
      try {
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
          onFinish: async ({ usage }) => {
            try {
              const budgetStatus = await recordChatSpend({
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
              });
              if (budgetStatus.spentUsd >= budgetStatus.limitUsd * 0.8) {
                console.warn("[guardrails] daily budget nearing limit", budgetStatus);
              }
            } catch (error) {
              console.error("[guardrails] failed to record chat spend", error);
            }
          },
        });

        writer.merge(result.toUIMessageStream());
        await result.consumeStream();

        if (collectedProducts.length > 0) {
          writer.write({
            type: "data-products",
            id: "products",
            data: collectedProducts,
          });
        }
      } catch (error) {
        console.error("[run-chat] execute failed", error);
        throw error;
      }
    },
    onEnd: () => {
      void appendConversationLog({
        session_id: options.sessionId,
        timestamp: new Date().toISOString(),
        user_message_preview: userPreview,
        search_calls: searchCalls,
        lookup_hits: 0,
        lookup_misses: searchCalls.length,
        assistant_text_preview: previewText(assistantText),
      }).catch((error) => {
        console.error("[run-chat] conversation log failed", error);
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
