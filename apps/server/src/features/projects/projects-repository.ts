import { and, asc, desc, eq, gt, isNotNull, isNull, lt, or } from "drizzle-orm";

import type { Database } from "@/db/database";
import { project } from "@/db/schema";

interface InsertProject {
  description: null | string;
  name: string;
  nameKey: string;
  ownerUserId: string;
}

interface UpdateProject {
  description?: null | string;
  name?: string;
  nameKey?: string;
}

export async function deleteProjectById(
  database: Database,
  ownerUserId: string,
  projectId: string,
) {
  const [deleted] = await database
    .delete(project)
    .where(and(eq(project.id, projectId), eq(project.ownerUserId, ownerUserId)))
    .returning({ id: project.id });
  return deleted ?? null;
}

export async function insertProject(database: Database, values: InsertProject) {
  const [created] = await database.insert(project).values(values).returning();
  if (!created) throw new Error("Project insert returned no row");
  return created;
}

export function findProjects(
  database: Database,
  ownerUserId: string,
  status: "active" | "all" | "archived",
  limit: number,
  cursor?: { id: string; isDefault: boolean; nameKey: string },
) {
  const statusCondition =
    status === "active"
      ? isNull(project.archivedAt)
      : status === "archived"
        ? isNotNull(project.archivedAt)
        : undefined;

  const cursorCondition = cursor
    ? or(
        lt(project.isDefault, cursor.isDefault),
        and(
          eq(project.isDefault, cursor.isDefault),
          or(
            gt(project.nameKey, cursor.nameKey),
            and(eq(project.nameKey, cursor.nameKey), gt(project.id, cursor.id)),
          ),
        ),
      )
    : undefined;

  return database
    .select()
    .from(project)
    .where(and(eq(project.ownerUserId, ownerUserId), statusCondition, cursorCondition))
    .orderBy(desc(project.isDefault), asc(project.nameKey), asc(project.id))
    .limit(limit);
}

export async function findProjectById(database: Database, ownerUserId: string, projectId: string) {
  const [found] = await database
    .select()
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.ownerUserId, ownerUserId)))
    .limit(1);
  return found ?? null;
}

export async function updateActiveProject(
  database: Database,
  ownerUserId: string,
  projectId: string,
  values: UpdateProject,
) {
  const [updated] = await database
    .update(project)
    .set({ ...values, updatedAt: new Date() })
    .where(
      and(
        eq(project.id, projectId),
        eq(project.ownerUserId, ownerUserId),
        isNull(project.archivedAt),
      ),
    )
    .returning();
  return updated ?? null;
}

export async function setProjectArchivedAt(
  database: Database,
  ownerUserId: string,
  projectId: string,
  archivedAt: Date | null,
) {
  const [updated] = await database
    .update(project)
    .set({ archivedAt, updatedAt: new Date() })
    .where(and(eq(project.id, projectId), eq(project.ownerUserId, ownerUserId)))
    .returning();
  return updated ?? null;
}
