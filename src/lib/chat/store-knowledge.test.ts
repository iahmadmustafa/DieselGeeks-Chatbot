import { describe, expect, it } from "vitest";

import { formatStoreKnowledgeForPrompt, getStoreKnowledge } from "./store-knowledge";

describe("store-knowledge", () => {
  it("includes the approved contact facts", () => {
    const knowledge = getStoreKnowledge("https://dieselgeeks.com.au/contact-us/");
    const prompt = formatStoreKnowledgeForPrompt(knowledge);

    expect(prompt).toContain("+61 02 8529 5003");
    expect(prompt).toContain("115-117 Auburn Street, Coniston, NSW 2500");
    expect(prompt).toContain("Monday–Friday 9:00am–5:00pm");
    expect(prompt).toContain("https://dieselgeeks.com.au/contact-us/");
    expect(prompt).toContain("Sell diesel injector and fuel-system parts");
  });
});
