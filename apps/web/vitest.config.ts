import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

const sharedAlias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  "@taskome/api-client": fileURLToPath(new URL("../../packages/api-client/src", import.meta.url)),
  "@taskome/ui": fileURLToPath(new URL("../../packages/ui/src", import.meta.url)),
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: sharedAlias,
  },
  test: {
    globals: false,
    clearMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
    },
    projects: [
      {
        resolve: {
          alias: {
            ...sharedAlias,
            "next/headers": fileURLToPath(new URL("./src/test/next-headers.ts", import.meta.url)),
          },
        },
        test: {
          name: "node",
          environment: "node",
          globals: false,
          include: ["src/app/**/*.test.ts", "src/lib/**/*.test.ts"],
          setupFiles: ["./src/test/setup.ts"],
        },
      },
      {
        resolve: {
          alias: sharedAlias,
        },
        test: {
          name: "jsdom",
          environment: "jsdom",
          environmentOptions: { jsdom: { url: "http://localhost:3000" } },
          globals: false,
          include: ["src/app/**/_components/**/*.test.tsx"],
          setupFiles: ["./src/test/setup.jsdom.ts"],
        },
      },
    ],
  },
});
