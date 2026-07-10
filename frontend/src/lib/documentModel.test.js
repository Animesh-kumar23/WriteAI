import { describe, expect, test } from "vitest";
import DocumentModel from "./documentModel";

describe("DocumentModel", () => {
  test("reconstructs text from chunks in order", () => {
    const model = new DocumentModel([
      { order: 2, content: "third" },
      { order: 0, content: "first " },
      { order: 1, content: "second " },
    ]);

    expect(model.getFullText()).toBe("first second third");
  });

  test("marks edited content as dirty", () => {
    const model = new DocumentModel([{ order: 0, content: "Hello", version: 0 }]);

    model.replaceRange(5, 5, " world");

    expect(model.getFullText()).toBe("Hello world");
    expect(model.getDirtyChunks()).toHaveLength(1);
    expect(model.getDirtyChunks()[0].content).toBe("Hello world");
  });
});
