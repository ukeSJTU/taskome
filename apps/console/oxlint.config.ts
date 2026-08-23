import { defineConfig } from "oxlint";

import reactConfig from "@taskome/config/oxlint/react";

export default defineConfig({
  ...reactConfig,
  ignorePatterns: ["src/routeTree.gen.ts"],
});
