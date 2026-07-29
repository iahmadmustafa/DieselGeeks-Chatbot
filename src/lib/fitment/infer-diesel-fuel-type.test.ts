import { describe, expect, it } from "vitest";

import {
  inferDieselFuelTypeFromEngineCodes,
  isKnownDieselEngineCode,
} from "@/lib/fitment/infer-diesel-fuel-type";

describe("infer diesel fuel type", () => {
  it("recognises known diesel engine code variants", () => {
    expect(isKnownDieselEngineCode("1KD-FTV")).toBe(true);
    expect(isKnownDieselEngineCode("TD42T")).toBe(true);
    expect(isKnownDieselEngineCode("ZD30DDTi")).toBe(true);
    expect(isKnownDieselEngineCode("1HD-FTE")).toBe(true);
  });

  it("rejects unknown or non-engine values", () => {
    expect(isKnownDieselEngineCode("12640381")).toBe(false);
    expect(isKnownDieselEngineCode("")).toBe(false);
    expect(inferDieselFuelTypeFromEngineCodes("")).toBe("");
  });

  it("infers Diesel when any listed engine code matches", () => {
    expect(inferDieselFuelTypeFromEngineCodes("P4AT, P5AT")).toBe("Diesel");
    expect(inferDieselFuelTypeFromEngineCodes("12640381")).toBe("");
  });
});
