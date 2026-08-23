import { defineConfig } from "oxlint";

import baseConfig from "@taskome/config/oxlint/base";

export default defineConfig({
  extends: [baseConfig],
  plugins: ["typescript", "unicorn", "oxc", "node"],
  env: {
    builtin: true,
    node: true,
  },
});
