import { defineConfig } from "orval";

export default defineConfig({
  api: {
    input: {
      target: "../server/openapi.json",
    },
    output: {
      clean: true,
      client: "react-query",
      formatter: "oxfmt",
      headers: false,
      httpClient: "fetch",
      indexFiles: true,
      mode: "tags-split",
      override: {
        enumGenerationType: "union",
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          name: "apiFetch",
          path: "./src/api/api-fetch.ts",
        },
        useBigInt: false,
        useDates: false,
        useNamedParameters: true,
      },
      schemas: "./src/api/generated/models",
      tagsSplitDeduplication: true,
      target: "./src/api/generated/api.ts",
      urlEncodeParameters: true,
    },
  },
});
