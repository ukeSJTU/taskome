import { problemDetails } from "@/http/errors/problem";
import type { SavedFilesModule } from "./saved-files-module";

function failure(c: any, error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error ? String(error.code) : "internal_error";
  const status = code === "saved_file_unavailable" ? 409 : code.endsWith("not_found") ? 404 : 500;
  return c.json(
    problemDetails(c, {
      code,
      detail: error instanceof Error ? error.message : "The request failed.",
      status,
      title:
        status === 404
          ? "Not found"
          : status === 409
            ? "Saved File unavailable"
            : "Internal server error",
    }),
    status,
    { "content-type": "application/problem+json; charset=UTF-8" },
  );
}

export function createSavedFileHandlers(module: SavedFilesModule) {
  return {
    createUpload: async (c: any) => {
      try {
        const file = await module.createUpload(
          c.get("securityContext").user.id,
          c.req.valid("json"),
        );
        c.header("location", `/api/v1/saved-files/${file.id}`);
        return c.json(file, 201);
      } catch (error) {
        return failure(c, error);
      }
    },
    list: async (c: any) => {
      try {
        return c.json(
          await module.listSavedFiles(
            c.get("securityContext").user.id,
            c.req.valid("query").projectId,
          ),
          200,
        );
      } catch (error) {
        return failure(c, error);
      }
    },
    confirm: async (c: any) => {
      try {
        return c.json(
          await module.confirmUpload(
            c.get("securityContext").user.id,
            c.req.valid("param").savedFileId,
          ),
          200,
        );
      } catch (error) {
        return failure(c, error);
      }
    },
    download: async (c: any) => {
      try {
        return c.json(
          await module.getDownload(
            c.get("securityContext").user.id,
            c.req.valid("param").savedFileId,
          ),
          200,
        );
      } catch (error) {
        return failure(c, error);
      }
    },
    remove: async (c: any) => {
      try {
        await module.deleteSavedFile(
          c.get("securityContext").user.id,
          c.req.valid("param").savedFileId,
        );
        return c.body(null, 204);
      } catch (error) {
        return failure(c, error);
      }
    },
  };
}
