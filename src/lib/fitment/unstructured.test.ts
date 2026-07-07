import { describe, expect, it } from "vitest";

import { isUnstructuredFitmentMessage } from "@/lib/fitment/unstructured";

describe("isUnstructuredFitmentMessage", () => {
  it("detects contact-us style fitment text", () => {
    expect(isUnstructuredFitmentMessage("Please contact us to confirm fitment")).toBe(true);
  });

  it("does not skip structured fitment text", () => {
    expect(
      isUnstructuredFitmentMessage(`Make: Isuzu
Models: D-Max
Engine Code: 4JJ1`),
    ).toBe(false);
  });

  it("treats empty fitment as unstructured", () => {
    expect(isUnstructuredFitmentMessage("   ")).toBe(true);
  });
});
