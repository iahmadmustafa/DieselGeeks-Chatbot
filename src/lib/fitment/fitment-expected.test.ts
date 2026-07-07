import { describe, expect, it } from "vitest";

import {
  classifyFitmentAttention,
  isFitmentExpected,
} from "@/lib/fitment/fitment-expected";

describe("isFitmentExpected", () => {
  it("returns false for T-shirts", () => {
    expect(isFitmentExpected("Diesel Tuner Parody T-shirt", ["Uncategorized"])).toBe(
      false,
    );
  });

  it("returns false for Xmas injector bundles", () => {
    expect(isFitmentExpected("11 Code 1KD Injector Bundle Xmas Special", [])).toBe(
      false,
    );
  });

  it("returns true for genuine injector products", () => {
    expect(
      isFitmentExpected("Genuine Diesel Injectors for Isuzu MUX & Dmax", [
        "Injectors",
      ]),
    ).toBe(true);
  });

  it("returns true for fuel pumps even when title mentions vehicle", () => {
    expect(
      isFitmentExpected(
        "Denso 294000-1210 Common Rail Fuel Pump – Suits Isuzu D-MAX",
        ["Fuel Pumps"],
      ),
    ).toBe(true);
  });
});

describe("classifyFitmentAttention", () => {
  it("classifies empty fitment", () => {
    expect(classifyFitmentAttention("", "Fitment field is empty")).toBe("Empty");
  });

  it("classifies HTML fitment with trailing contact link as reformat", () => {
    expect(
      classifyFitmentAttention(
        `<ul><li><strong>Toyota LandCruiser 105 Series</strong></li></ul>Contact Us`,
        "No structured fitment data (unstructured text)",
      ),
    ).toBe("Reformat");
  });

  it("classifies contact-only placeholder as add content", () => {
    expect(
      classifyFitmentAttention(
        "For fitment information, please contact us",
        "No structured fitment data (unstructured text)",
      ),
    ).toBe("Add content");
  });
});
