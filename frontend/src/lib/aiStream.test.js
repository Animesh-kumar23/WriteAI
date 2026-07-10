import { afterEach, describe, expect, test, vi } from "vitest";
import { streamAIContent } from "./aiStream";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streamAIContent", () => {
  test("processes response chunks in order", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("first "));
        controller.enqueue(encoder.encode("second"));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body }));
    const received = [];

    await streamAIContent({ action: "generate" }, (chunk) => received.push(chunk));

    expect(received).toEqual(["first ", "second"]);
  });

  test("throws the API error and status for an unsuccessful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: "Daily limit reached" }),
      })
    );

    await expect(streamAIContent({}, () => {})).rejects.toMatchObject({
      message: "Daily limit reached",
      status: 429,
    });
  });

  test("forwards aborts from the supplied signal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_, { signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        })
      )
    );
    const controller = new AbortController();

    const streaming = streamAIContent({}, () => {}, controller.signal);
    controller.abort();

    await expect(streaming).rejects.toMatchObject({ name: "AbortError" });
  });
});
