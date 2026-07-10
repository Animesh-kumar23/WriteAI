import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

const testStorage = new Map();

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key) => testStorage.get(key) ?? null,
    setItem: (key, value) => testStorage.set(key, String(value)),
    removeItem: (key) => testStorage.delete(key),
    clear: () => testStorage.clear(),
  },
});

afterEach(() => {
  cleanup();
  testStorage.clear();
});
