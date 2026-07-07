import { convertToModelMessages, tool } from "ai";
import { z } from "zod";

import { createChatTools } from "../src/lib/chat/tools";
import type { ProductSnapshot } from "../src/types/catalog";

const snapshot: ProductSnapshot = {
  version: "test",
  synced_at: new Date().toISOString(),
  product_count: 1,
  products: [
    {
      id: 15625,
      sku: "test-sku",
      title: "4JJ1 Pre DPF High Flow Nozzle Kit",
      price: "1100",
      sale_price: null,
      stock_status: "instock",
      categories: ["Injectors"],
      permalink: "https://example.com/product",
      image_url: null,
      short_description: "test",
      fitment_raw: "Make: Isuzu",
      fitment: {
        makes: ["Isuzu"],
        models: ["D-Max"],
        engine_codes: ["4JJ1"],
        fuel_type: "Diesel",
        fuel_system: "Common Rail",
        year_ranges: { "Isuzu D-Max": { from: 2007, to: 2016 } },
        notes: null,
      },
      fitment_parse_method: "deterministic",
      fitment_parse_error: null,
      fitment_expected: true,
    },
  ],
};

const tools = createChatTools(snapshot, { onSearchComplete: () => {} });

const assistantMessage = {
  id: "asst-1",
  role: "assistant" as const,
  parts: [
    { type: "step-start" as const },
    { type: "text" as const, text: "Here are matching products." },
    {
      type: "tool-search_products" as const,
      toolCallId: "call_test",
      state: "output-available" as const,
      input: {
        make: "Isuzu",
        model: "D-Max",
        engine_code: "4JJ1",
        year: 2010,
      },
      output: {
        match_type: "structured",
        result_count: 1,
        products: [
          {
            id: 15625,
            title: "4JJ1 Pre DPF High Flow Nozzle Kit",
            price: "1100",
            sale_price: null,
            stock_status: "instock",
            image_url: null,
            permalink: "https://example.com/product",
            sku: "test-sku",
            fitment_expected: true,
            fitment_summary: "Models: D-Max",
          },
        ],
        out_of_catalog_scope: false,
        out_of_scope_reason: null,
        clarifying_questions_allowed: false,
        catalog_scope_summary: "test",
      },
      providerExecuted: true,
    },
    {
      type: "data-products" as const,
      data: [
        {
          id: 15625,
          title: "4JJ1 Pre DPF High Flow Nozzle Kit",
          price: "1100",
          sale_price: null,
          stock_status: "instock",
          image_url: null,
          permalink: "https://example.com/product",
          sku: "test-sku",
          fitment_expected: true,
          fitment_summary: "Models: D-Max",
        },
      ],
    },
  ],
};

async function main(): Promise<void> {
  const messages = [
    {
      id: "user-1",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "4JJ1 injectors for a 2010 Isuzu D-Max" }],
    },
    assistantMessage,
    {
      id: "user-2",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "Which is the full set?" }],
    },
  ];

  try {
    const modelMessages = await convertToModelMessages(messages, { tools });
    console.log("convert OK", modelMessages.length, "messages");
  } catch (error) {
    console.error("convert FAIL", error);
    process.exit(1);
  }
}

main();
