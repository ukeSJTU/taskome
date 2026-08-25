import { and, asc, eq } from "drizzle-orm";

import type { Database } from "@/db/database";
import { project, savedFile } from "@/db/schema";

export function findOwnedSavedFile(database: Database, ownerUserId: string, id: string) {
  return database.query.savedFile.findFirst({
    where: and(eq(savedFile.id, id), eq(savedFile.ownerUserId, ownerUserId)),
  });
}
export function findOwnedProject(database: Database, ownerUserId: string, projectId: string) {
  return database.query.project.findFirst({
    where: and(eq(project.id, projectId), eq(project.ownerUserId, ownerUserId)),
  });
}
export async function insertSavedFile(database: Database, values: typeof savedFile.$inferInsert) {
  const [file] = await database.insert(savedFile).values(values).returning();
  if (!file) throw new Error("Saved File insert returned no row");
  return file;
}
export async function markSavedFileUploaded(database: Database, id: string) {
  const [file] = await database
    .update(savedFile)
    .set({ status: "uploaded", updatedAt: new Date() })
    .where(eq(savedFile.id, id))
    .returning();
  return file ?? null;
}
export function deleteSavedFileById(database: Database, id: string) {
  return database.delete(savedFile).where(eq(savedFile.id, id));
}
export function findSavedFiles(database: Database, ownerUserId: string, projectId?: string) {
  return database
    .select()
    .from(savedFile)
    .where(
      and(
        eq(savedFile.ownerUserId, ownerUserId),
        projectId ? eq(savedFile.projectId, projectId) : undefined,
      ),
    )
    .orderBy(asc(savedFile.createdAt));
}
