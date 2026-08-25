import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";

import type { SecurityContext } from "@/auth/security-context";
import type { SavedFilesModule } from "./saved-files-module";

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

export function registerSavedFileTools(server: McpServer, savedFiles: SavedFilesModule) {
  server.registerTool(
    "create_saved_file_upload",
    {
      description:
        "Create a Saved File and return a short-lived upload URL. The response never contains file bytes.",
      inputSchema: {
        contentType: z.string().max(255).optional(),
        filename: z.string().trim().min(1).max(1024),
        projectId: z.uuid(),
        sizeBytes: z
          .number()
          .int()
          .positive()
          .max(2 * 1024 * 1024 * 1024),
      },
    },
    async (input, context) => {
      const securityContext = (
        context.http?.authInfo?.extra as { securityContext?: SecurityContext } | undefined
      )?.securityContext;
      if (!securityContext) throw new Error("Taskome authentication context is missing.");
      return text(await savedFiles.createUpload(securityContext.user.id, input));
    },
  );
  server.registerTool(
    "get_saved_file_download",
    {
      description:
        "Return a short-lived download URL for an uploaded Saved File. The response never contains file bytes.",
      inputSchema: { savedFileId: z.uuid() },
    },
    async (input, context) => {
      const securityContext = (
        context.http?.authInfo?.extra as { securityContext?: SecurityContext } | undefined
      )?.securityContext;
      if (!securityContext) throw new Error("Taskome authentication context is missing.");
      return text(await savedFiles.getDownload(securityContext.user.id, input.savedFileId));
    },
  );
}
