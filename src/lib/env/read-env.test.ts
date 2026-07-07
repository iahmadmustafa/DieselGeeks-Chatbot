import { afterEach, describe, expect, it } from "vitest";

import { readEnv } from "@/lib/env/read-env";

describe("readEnv", () => {
  const original = process.env.TEST_ENV_VAR;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.TEST_ENV_VAR;
    } else {
      process.env.TEST_ENV_VAR = original;
    }
  });

  it("trims whitespace and Windows carriage returns", () => {
    process.env.TEST_ENV_VAR = "  sk-test-key\r\n";
    expect(readEnv("TEST_ENV_VAR")).toBe("sk-test-key");
  });

  it("strips surrounding quotes", () => {
    process.env.TEST_ENV_VAR = '"quoted-value"';
    expect(readEnv("TEST_ENV_VAR")).toBe("quoted-value");
  });

  it("returns null for missing or empty values", () => {
    delete process.env.TEST_ENV_VAR;
    expect(readEnv("TEST_ENV_VAR")).toBeNull();

    process.env.TEST_ENV_VAR = "   ";
    expect(readEnv("TEST_ENV_VAR")).toBeNull();
  });
});
