import { describe, expect, it } from "vitest";

import type { ChatUIMessage } from "../types";
import { deriveActivitySteps } from "./ActivityStatus";

function assistantWithParts(parts: ChatUIMessage["parts"]): ChatUIMessage {
  return {
    id: "a1",
    role: "assistant",
    parts,
  } as ChatUIMessage;
}

describe("deriveActivitySteps", () => {
  it("starts on Thinking while submitted", () => {
    const steps = deriveActivitySteps("submitted", undefined, false);
    expect(steps[0]).toMatchObject({ id: "thinking", phase: "active" });
    expect(steps.some((step) => step.id === "searching")).toBe(false);
  });

  it("soft-advances to Checking without inventing a catalog search", () => {
    const steps = deriveActivitySteps("submitted", undefined, true);
    expect(steps.find((step) => step.id === "thinking")?.phase).toBe("done");
    expect(steps.find((step) => step.id === "checking")?.phase).toBe("active");
    expect(steps.some((step) => step.id === "searching")).toBe(false);
  });

  it("shows Searching only when the search tool is in progress", () => {
    const message = assistantWithParts([
      {
        type: "tool-search_products",
        toolCallId: "t1",
        state: "input-available",
        input: {},
      } as ChatUIMessage["parts"][number],
    ]);

    const steps = deriveActivitySteps("streaming", message, false);
    expect(steps.find((step) => step.id === "searching")?.phase).toBe("active");
    expect(steps.find((step) => step.id === "thinking")?.phase).toBe("done");
  });

  it("moves to Preparing your answer after tools finish and before text", () => {
    const message = assistantWithParts([
      {
        type: "tool-search_products",
        toolCallId: "t1",
        state: "output-available",
        input: {},
        output: {
          products: [
            {
              id: 1,
              title: "Injector",
              price: "100",
              sale_price: null,
              stock_status: "instock",
              image_url: null,
              permalink: "https://example.com",
              sku: "X",
              fitment_expected: true,
              fitment_summary: null,
            },
          ],
        },
      } as ChatUIMessage["parts"][number],
    ]);

    // Products in tool output must still show "Preparing…" — ChatThread keeps
    // the activity visible until reply text arrives (cards are held back).
    const steps = deriveActivitySteps("streaming", message, false);
    expect(steps.find((step) => step.id === "writing")?.phase).toBe("active");
    expect(steps.find((step) => step.id === "searching")?.phase).toBe("done");
  });

  it("shows Looking up vehicles for list_catalog_makes", () => {
    const message = assistantWithParts([
      {
        type: "tool-list_catalog_makes",
        toolCallId: "t2",
        state: "input-available",
        input: {},
      } as ChatUIMessage["parts"][number],
    ]);

    const steps = deriveActivitySteps("streaming", message, false);
    expect(steps.find((step) => step.id === "makes")?.phase).toBe("active");
  });
});
