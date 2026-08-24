import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const project = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    isDefault: boolean("is_default").default(false).notNull(),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    description: text("description"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "projects_name_length_check",
      sql`char_length(${table.name}) between 1 and 100 and ${table.name} = btrim(${table.name})`,
    ),
    check(
      "projects_description_length_check",
      sql`${table.description} is null or char_length(${table.description}) <= 1000`,
    ),
    check(
      "projects_default_active_check",
      sql`not ${table.isDefault} or ${table.archivedAt} is null`,
    ),
    uniqueIndex("projects_owner_name_key_uidx").on(table.ownerUserId, table.nameKey),
    uniqueIndex("projects_owner_default_uidx")
      .on(table.ownerUserId)
      .where(sql`${table.isDefault}`),
    index("projects_owner_archived_name_idx").on(
      table.ownerUserId,
      table.archivedAt,
      table.nameKey,
    ),
  ],
);

export const projectRelations = relations(project, ({ one }) => ({
  owner: one(user, {
    fields: [project.ownerUserId],
    references: [user.id],
  }),
}));
