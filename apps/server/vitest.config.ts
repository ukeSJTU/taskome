import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
};

export default defineConfig({
  test: {
    coverage: {
      exclude: ["src/db/schema/**", "src/index.ts", "src/test/**"],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
    },
    projects: [
      {
        resolve: { alias },
        test: {
          environment: "node",
          include: ["src/**/*.test.ts"],
          name: "unit",
          setupFiles: ["./src/test/setup.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          environment: "node",
          fileParallelism: false,
          hookTimeout: 120_000,
          include: ["test/integration/**/*.test.ts"],
          name: "integration",
          setupFiles: ["./src/test/setup.ts"],
          testTimeout: 120_000,
        },
      },
    ],
  },
});
