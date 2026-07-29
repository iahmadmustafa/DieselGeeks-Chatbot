import { describe, expect, it } from "vitest";

import { fitmentRawToPlainText } from "@/lib/text/strip-html";

describe("fitmentRawToPlainText", () => {
  it("preserves line breaks from HTML list items", () => {
    const plain = fitmentRawToPlainText(`<ul>
<li><strong>Make:</strong> Toyota</li>
<li><strong>Models:</strong> Hilux</li>
</ul>`);

    expect(plain).toBe("Make: Toyota\nModels: Hilux");
  });

  it("inserts line breaks before bold fitment labels", () => {
    const plain = fitmentRawToPlainText(
      `<b>Make</b><span>: Ford</span><b>Models</b><span>: Ranger</span>`,
    );

    expect(plain).toBe("Make: Ford\nModels: Ranger");
  });
});
