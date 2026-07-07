import { describe, expect, it } from "vitest";

import { parseFitmentDeterministic } from "@/lib/fitment/parser";

const EXAMPLE_FITMENT = `Make: Isuzu / Holden
Models: D-Max, MU-X, Colorado RC, Rodeo RA7
Engine Code: 4JJ1 (Pre-DPF only)
Fuel Type: Diesel
Fuel System: Common Rail
Year Range:
Isuzu D-Max: 2007–2016
Isuzu MU-X: 2012–2016`;

describe("parseFitmentDeterministic", () => {
  it("parses the canonical Diesel Geeks fitment format", () => {
    const result = parseFitmentDeterministic(EXAMPLE_FITMENT);

    expect(result.parseError).toBeNull();
    expect(result.method).toBe("deterministic");
    expect(result.fitment.makes).toEqual(["Isuzu", "Holden"]);
    expect(result.fitment.models).toEqual([
      "D-Max",
      "MU-X",
      "Colorado RC",
      "Rodeo RA7",
    ]);
    expect(result.fitment.engine_codes).toEqual(["4JJ1"]);
    expect(result.fitment.fuel_type).toBe("Diesel");
    expect(result.fitment.fuel_system).toBe("Common Rail");
    expect(result.fitment.notes).toBe("Pre-DPF only");
    expect(result.fitment.year_ranges["Isuzu D-Max"]).toEqual({
      from: 2007,
      to: 2016,
    });
    expect(result.fitment.year_ranges["Isuzu MU-X"]).toEqual({
      from: 2012,
      to: 2016,
    });
  });

  it("flags empty fitment for review", () => {
    const result = parseFitmentDeterministic("   ");

    expect(result.method).toBe("empty");
    expect(result.parseError).toBe("Fitment field is empty");
  });

  it("handles hyphenated year ranges", () => {
    const result = parseFitmentDeterministic(`Make: Toyota
Models: LandCruiser
Engine Code: 1VD-FTV
Year Range:
Toyota LandCruiser 200 Series: 2007-2015`);

    expect(result.parseError).toBeNull();
    expect(result.fitment.year_ranges["Toyota LandCruiser 200 Series"]).toEqual({
      from: 2007,
      to: 2015,
    });
  });

  it("flags unstructured fitment text", () => {
    const result = parseFitmentDeterministic("Fits most diesel utes, ask us for details");

    expect(result.parseError).not.toBeNull();
  });
});
