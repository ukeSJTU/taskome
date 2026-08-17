import { defineConfig } from "orval";

export default defineConfig({
  gateway: {
    input: {
      filters: {
        mode: "exclude",
        tags: ["health"],
      },
      target: "./openapi.public.json",
    },
    output: {
      clean: true,
      client: "fetch",
      // TODO: Enable when gateway exposes caller-controlled headers such as If-Match or Idempotency-Key.
      headers: false,
      indexFiles: true,
      mode: "tags-split",
      schemas: "./src/generated/gateway/models",
      tagsSplitDeduplication: true,
      urlEncodeParameters: true,
      override: {
        enumGenerationType: "union",
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          name: "gatewayFetch",
          path: "./src/mutator.ts",
        },
        useBigInt: false,
        useDates: false,
        useNamedParameters: true,
      },
      target: "./src/generated/gateway/client.ts",
    },
  },
});
