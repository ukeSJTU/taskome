import { defineConfig } from "oxlint";

import reactConfig from "@taskome/config/oxlint/react";

export default defineConfig({
  ...reactConfig,
  plugins: ["typescript", "unicorn", "oxc", "import", "react", "nextjs"],
  env: {
    builtin: true,
    browser: true,
    node: true,
  },
});
