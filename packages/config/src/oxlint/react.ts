import { defineConfig } from "oxlint";

import baseConfig from "@taskome/config/oxlint/base";

export default defineConfig({
  extends: [baseConfig],
  plugins: ["typescript", "unicorn", "oxc", "import", "react"],
  env: {
    builtin: true,
    browser: true,
  },
  settings: {
    react: {
      version: "19.2.8",
    },
    tailwindcss: {
      callees: ["clsx", "cva", "cn"],
    },
  },
});
