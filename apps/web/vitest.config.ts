import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@taskome/api-client": fileURLToPath(
        new URL("../../packages/api-client/src", import.meta.url),
      ),
      "@taskome/ui": fileURLToPath(new URL("../../packages/ui/src", import.meta.url)),
      "next/headers": fileURLToPath(new URL("./src/test-mocks/next-headers.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
