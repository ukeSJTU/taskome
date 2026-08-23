import { defineConfig } from "oxlint";

import baseConfig from "@taskome/config/oxlint/base";

export default defineConfig({
  extends: [baseConfig],
  overrides: [
    {
      files: ["src/server.ts", "src/server/**/*.ts"],
      env: {
        builtin: true,
        node: true,
      },
    },
    {
      files: ["src/console.ts"],
      env: {
        builtin: true,
        browser: true,
      },
    },
  ],
});
