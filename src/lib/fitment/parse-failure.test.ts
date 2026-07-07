import { describe, expect, it } from "vitest";

import { classifyParseFailure } from "@/lib/fitment/parse-failure";

describe("classifyParseFailure", () => {
  it("classifies contact-us fitment as no data available", () => {
    expect(
      classifyParseFailure(
        "No structured fitment data (unstructured text)",
        "For fitment information, please contact us",
      ),
    ).toBe("no_data_available");
  });

  it("classifies token budget errors separately", () => {
    expect(
      classifyParseFailure(
        "LLM token budget exhausted during reasoning (finishReason: length)",
        "Make: Toyota",
      ),
    ).toBe("token_or_reasoning_limit");
  });
});
