import { and, asc, eq } from "drizzle-orm";
import type { Database } from "@/db/database";
import { project, savedFile } from "@/db/schema";
import type { ObjectStorage } from "./object-storage";

export interface SavedFileView {
  id: string;
  projectId: string;
  filename: string;
  contentType: null | string;
  sizeBytes: number;
  status: "pending" | "uploaded";
  createdAt: string;
}
export interface SavedFilesModule {
  createUpload(
    ownerUserId: string,
    input: { projectId: string; filename: string; contentType?: string; sizeBytes: number },
  ): Promise<SavedFileView & { uploadUrl: string }>;
  confirmUpload(ownerUserId: string, id: string): Promise<SavedFileView>;
  getDownload(ownerUserId: string, id: string): Promise<SavedFileView & { downloadUrl: string }>;
  deleteSavedFile(ownerUserId: string, id: string): Promise<void>;
  listSavedFiles(
    ownerUserId: string,
    projectId?: string,
  ): Promise<{ items: SavedFileView[]; nextCursor: null }>;
}
const view = (file: typeof savedFile.$inferSelect): SavedFileView => ({
  id: file.id,
  projectId: file.projectId,
  filename: file.filename,
  contentType: file.contentType,
  sizeBytes: file.sizeBytes,
  status: file.status,
  createdAt: file.createdAt.toISOString(),
});
const missing = () =>
  Object.assign(new Error("The Saved File does not exist."), { code: "saved_file_not_found" });
const unavailable = () =>
  Object.assign(new Error("The Saved File has not finished uploading."), {
    code: "saved_file_unavailable",
  });

export function createSavedFilesModule(
  database: Database,
  storage: ObjectStorage,
): SavedFilesModule {
  async function owned(ownerUserId: string, id: string) {
    const [file] = await database
      .select()
      .from(savedFile)
      .where(and(eq(savedFile.id, id), eq(savedFile.ownerUserId, ownerUserId)))
      .limit(1);
    if (!file) throw missing();
    return file;
  }
  return {
    async createUpload(ownerUserId, input) {
      const [ownedProject] = await database
        .select({ id: project.id })
        .from(project)
        .where(and(eq(project.id, input.projectId), eq(project.ownerUserId, ownerUserId)))
        .limit(1);
      if (!ownedProject)
        throw Object.assign(new Error("The Project does not exist."), {
          code: "project_not_found",
        });
      const id = crypto.randomUUID();
      const storageKey = `saved-files/${id}`;
      const [file] = await database
        .insert(savedFile)
        .values({
          id,
          projectId: input.projectId,
          ownerUserId,
          filename: input.filename,
          contentType: input.contentType ?? null,
          sizeBytes: input.sizeBytes,
          storageKey,
        })
        .returning();
      if (!file) throw new Error("Saved File insert returned no row");
      return {
        ...view(file),
        uploadUrl: await storage.issueUploadUrl(storageKey, input.sizeBytes),
      };
    },
    async confirmUpload(ownerUserId, id) {
      const file = await owned(ownerUserId, id);
      if (!(await storage.exists(file.storageKey))) throw unavailable();
      const [updated] = await database
        .update(savedFile)
        .set({ status: "uploaded", updatedAt: new Date() })
        .where(eq(savedFile.id, id))
        .returning();
      return view(updated ?? file);
    },
    async getDownload(ownerUserId, id) {
      const file = await owned(ownerUserId, id);
      if (!(await storage.exists(file.storageKey))) throw unavailable();
      const available =
        file.status === "uploaded"
          ? file
          : ((
              await database
                .update(savedFile)
                .set({ status: "uploaded", updatedAt: new Date() })
                .where(eq(savedFile.id, id))
                .returning()
            )[0] ?? file);
      return { ...view(available), downloadUrl: await storage.issueDownloadUrl(file.storageKey) };
    },
    async deleteSavedFile(ownerUserId, id) {
      const file = await owned(ownerUserId, id);
      await storage.deleteObject(file.storageKey);
      await database.delete(savedFile).where(eq(savedFile.id, id));
    },
    async listSavedFiles(ownerUserId, projectId) {
      const files = await database
        .select()
        .from(savedFile)
        .where(
          and(
            eq(savedFile.ownerUserId, ownerUserId),
            projectId ? eq(savedFile.projectId, projectId) : undefined,
          ),
        )
        .orderBy(asc(savedFile.createdAt));
      return { items: files.map(view), nextCursor: null };
    },
  };
}
