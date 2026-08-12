import { describe, expect, it } from "vitest";

import { getComparisonFromMessage } from "./get-comparison-from-messages";
import type { ChatUIMessage, ProductCard } from "./types";

const sampleProduct = (id: number): ProductCard => ({
  id,
  title: `Product ${id}`,
  price: "100",
  sale_price: null,
  stock_status: "instock",
  image_url: null,
  permalink: `https://example.com/${id}`,
  sku: `SKU-${id}`,
  fitment_expected: true,
  fitment_summary: "Makes: Isuzu",
});

describe("getComparisonFromMessage", () => {
  it("reads a successful compare_products tool result", () => {
    const message = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-compare_products",
          toolCallId: "c1",
          state: "output-available",
          input: {},
          output: {
            ok: true,
            products: [sampleProduct(1), sampleProduct(2)],
            unresolved: [],
            ambiguous: [],
            error: null,
          },
        },
      ],
    } as ChatUIMessage;

    const comparison = getComparisonFromMessage(message);
    expect(comparison?.products).toHaveLength(2);
    expect(comparison?.products[0]?.id).toBe(1);
  });

  it("ignores failed compare results", () => {
    const message = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-compare_products",
          toolCallId: "c1",
          state: "output-available",
          input: {},
          output: {
            ok: false,
            products: [sampleProduct(1)],
            unresolved: ["missing"],
            ambiguous: [],
            error: "Need at least two",
          },
        },
      ],
    } as ChatUIMessage;

    expect(getComparisonFromMessage(message)).toBeNull();
  });
});
