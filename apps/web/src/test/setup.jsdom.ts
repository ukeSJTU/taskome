import "@testing-library/jest-dom/vitest";
import "./setup";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library's own auto-cleanup relies on an implicit global `afterEach`,
// which `globals: false` (vitest.config.ts) doesn't provide — register it explicitly.
afterEach(cleanup);

if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
