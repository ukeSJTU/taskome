import { describe, expect, it } from "vitest";

import { registerSavedFileTools } from "./mcp-tools";

describe("Saved File MCP tools", () => {
  it("returns only metadata and signed URLs using the authenticated user", async () => {
    const tools = new Map<
      string,
      (input: any, context: any) => Promise<{ content: { text: string }[] }>
    >();
    registerSavedFileTools(
      {
        registerTool: (name: string, _definition: unknown, handler: any) =>
          tools.set(name, handler),
      } as any,
      {
        createUpload: (owner, input) =>
          Promise.resolve({
            ...input,
            contentType: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            id: "file-1",
            owner,
            status: "pending" as const,
            uploadUrl: "https://storage.example/upload",
          }),
        getDownload: (owner, id) =>
          Promise.resolve({
            contentType: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            filename: "input.pdb",
            id,
            owner,
            projectId: "project-1",
            sizeBytes: 1,
            status: "uploaded" as const,
            downloadUrl: "https://storage.example/download",
          }),
        confirmUpload: () => Promise.reject(new Error("unused")),
        deleteSavedFile: () => Promise.reject(new Error("unused")),
        listSavedFiles: () => Promise.resolve({ items: [], nextCursor: null }),
      },
    );
    const context = {
      http: { authInfo: { extra: { securityContext: { user: { id: "user-1" } } } } },
    };
    const result = await tools.get("create_saved_file_upload")?.(
      { filename: "input.pdb", projectId: "00000000-0000-4000-8000-000000000001", sizeBytes: 1 },
      context,
    );
    expect(JSON.parse(result?.content[0]?.text ?? "{}")).toMatchObject({
      id: "file-1",
      owner: "user-1",
      uploadUrl: "https://storage.example/upload",
    });
  });
});
