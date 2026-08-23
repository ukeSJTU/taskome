import { defineConfig } from "oxlint";

import baseConfig from "@taskome/config/oxlint/base";

export default defineConfig({
  ...baseConfig,
  ignorePatterns: [".agents/**", ".claude/**", ".codex/**", "references/**"],
});
