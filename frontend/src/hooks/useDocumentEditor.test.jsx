import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import axiosInstance from "../lib/axios";
import useDocumentEditor from "./useDocumentEditor";

vi.mock("../lib/axios", () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    isCancel: vi.fn(() => false),
  },
}));

describe("useDocumentEditor saves", () => {
  beforeEach(() => {
    axiosInstance.get.mockResolvedValue({
      data: {
        chunks: [{ order: 0, content: "Hello", version: 0 }],
      },
    });
    axiosInstance.patch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test("acknowledges a successful save", async () => {
    const onAllSaved = vi.fn();
    axiosInstance.patch.mockResolvedValue({ data: { updated: 1 } });
    const { result } = renderHook(() =>
      useDocumentEditor("document-1", onAllSaved)
    );

    await waitFor(() => expect(result.current.chunks).toHaveLength(1));
    vi.useFakeTimers();

    act(() => result.current.handleDocumentEdit(5, 5, "!"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(axiosInstance.patch).toHaveBeenCalledOnce();
    expect(onAllSaved).toHaveBeenCalledOnce();
  });

  test("keeps a newer edit dirty while an earlier save is in flight", async () => {
    let resolveFirstSave;
    const firstSave = new Promise((resolve) => {
      resolveFirstSave = resolve;
    });
    const onAllSaved = vi.fn();
    axiosInstance.patch
      .mockReturnValueOnce(firstSave)
      .mockResolvedValueOnce({ data: { updated: 1 } });
    const { result } = renderHook(() =>
      useDocumentEditor("document-2", onAllSaved)
    );

    await waitFor(() => expect(result.current.chunks).toHaveLength(1));
    vi.useFakeTimers();

    act(() => result.current.handleDocumentEdit(5, 5, "!"));
    act(() => vi.advanceTimersByTime(1200));
    await act(async () => Promise.resolve());
    expect(axiosInstance.patch).toHaveBeenCalledTimes(1);

    act(() => result.current.handleDocumentEdit(6, 6, "?"));
    await act(async () => {
      resolveFirstSave({ data: { updated: 1 } });
      await Promise.resolve();
    });
    expect(onAllSaved).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });
    expect(axiosInstance.patch).toHaveBeenCalledTimes(2);
    expect(onAllSaved).toHaveBeenCalledOnce();
  });
});
