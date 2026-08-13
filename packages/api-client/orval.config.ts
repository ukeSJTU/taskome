import { defineConfig } from "orval";

export default defineConfig({
  gateway: {
    input: "./openapi.json",
    output: {
      clean: true,
      client: "fetch",
      mode: "single",
      override: {
        mutator: {
          name: "gatewayFetch",
          path: "./src/mutator.ts",
        },
      },
      target: "./src/generated/gateway.ts",
    },
  },
});
