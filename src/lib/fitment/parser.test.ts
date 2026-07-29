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

  it("parses HTML list fitment with strong labels", () => {
    const result = parseFitmentDeterministic(`<ul>
\t<li><strong>Make:</strong> Ford / Mazda</li>
\t<li><strong>Models:</strong> Ranger / BT-50 / B-Series</li>
\t<li><strong>Engine Codes:</strong> WLAT, WEAT, DPAT</li>
\t<li><strong>Fuel Type:</strong> Diesel</li>
\t<li><strong>Year Range:</strong> 2006 to 2011 (verify by VIN or engine code)</li>
</ul>`);

    expect(result.parseError).toBeNull();
    expect(result.fitment.makes).toEqual(["Ford", "Mazda"]);
    expect(result.fitment.models).toEqual(["Ranger", "BT-50", "B-Series"]);
    expect(result.fitment.engine_codes).toEqual(["WLAT", "WEAT", "DPAT"]);
    expect(result.fitment.fuel_type).toBe("Diesel");
    expect(result.fitment.year_ranges.Vehicle).toEqual({ from: 2006, to: 2011 });
  });

  it("parses bold tag fitment labels", () => {
    const result = parseFitmentDeterministic(`<b>Make</b><span style="font-weight: 400">: Ford / Mazda</span><span style="font-weight: 400">
</span><b>Models</b><span style="font-weight: 400">: Ranger PX, Ranger PY, BT-50 UP</span><span style="font-weight: 400">
</span><b>Engine Codes</b><span style="font-weight: 400">: P5AT 3.2L Diesel</span><span style="font-weight: 400">
</span><b>Year Range</b><span style="font-weight: 400">: 2011 to 2022 (verify by VIN or engine code)</span>`);

    expect(result.parseError).toBeNull();
    expect(result.fitment.makes).toEqual(["Ford", "Mazda"]);
    expect(result.fitment.engine_codes).toEqual(["P5AT 3.2L Diesel"]);
    expect(result.fitment.year_ranges.Vehicle).toEqual({ from: 2011, to: 2022 });
  });

  it("parses singular model and engine code from HTML lists", () => {
    const result = parseFitmentDeterministic(`<ul>
\t<li><strong>Make:</strong> Toyota</li>
\t<li><strong>Model:</strong> LandCruiser 70 Series</li>
\t<li><strong>Engine Code:</strong> 1HD-FTE</li>
\t<li><strong>Year Range:</strong> 1998 to 2007 (verify by engine code or VIN)</li>
</ul>`);

    expect(result.parseError).toBeNull();
    expect(result.fitment.makes).toEqual(["Toyota"]);
    expect(result.fitment.models).toEqual(["LandCruiser 70 Series"]);
    expect(result.fitment.engine_codes).toEqual(["1HD-FTE"]);
  });

  it("parses Engine label without Code suffix", () => {
    const result = parseFitmentDeterministic(`Injectors: Denso 295050-0460 (18 code)
Make: Toyota
Models: Hilux / Prado
Engine: 1KD-FTV
Year Range: 2009-2015
Fuel Type: Diesel`);

    expect(result.parseError).toBeNull();
    expect(result.fitment.engine_codes).toEqual(["1KD-FTV"]);
  });

  it("parses compatibility bullet lines with make, model, and engine", () => {
    const result = parseFitmentDeterministic(`Compatible with:
Nissan Navara D40 (YD25 engine)
Nissan Pathfinder with YD2K engine
Model years: 2010 to end of production
For fitment confirmation, visit example.com/contact-us.`);

    expect(result.parseError).toBeNull();
    expect(result.fitment.makes).toEqual(["Nissan"]);
    expect(result.fitment.models).toEqual(["Navara D40", "Pathfinder"]);
    expect(result.fitment.engine_codes).toEqual(["YD25", "YD2K"]);
    expect(result.fitment.year_ranges.Vehicle).toEqual({ from: 2010, to: 2026 });
  });
});
