import { describe, expect, test } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { generatePdfBuffer } = require("../src/utils/pdf.generator.js");
const { parsePdfBuffer } = require("../src/utils/import.parser.js");

describe("PDF generation", () => {
  test("maps supported Markdown blocks to readable PDF text", async () => {
    const buffer = await generatePdfBuffer({
      title: "Export title",
      subtitle: "Export subtitle",
      content: [
        "## Heading",
        "",
        "A **bold** paragraph with [a link](https://example.com).",
        "",
        "- First item",
        "- Second item",
        "",
        "```js",
        "const answer = 42;",
        "```",
        "",
        "> Quoted paragraph",
        "",
        "![Diagram](diagram.png)",
      ].join("\n"),
    });

    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");

    const text = await parsePdfBuffer(buffer);
    expect(text).toContain("Export title");
    expect(text).toContain("Heading");
    expect(text).toContain("A bold paragraph with a link.");
    expect(text).toContain("First item");
    expect(text).toContain("const answer = 42;");
    expect(text).toContain("Quoted paragraph");
    expect(text).toContain("Diagram");
    expect(text).not.toContain("**bold**");
  });
});
