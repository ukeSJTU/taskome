import { defineConfig } from "oxlint";

import nextConfig from "@taskome/config/oxlint/next";

export default defineConfig({
  ...nextConfig,
  ignorePatterns: ["node_modules/", "dist/"],
});
