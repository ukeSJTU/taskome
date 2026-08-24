import { sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const oauthGrantState = pgEnum("oauth_grant_state", ["pending", "active", "revoked"]);

export const oauthGrant = pgTable(
  "oauth_grant",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    resource: text("resource").notNull(),
    scopes: text("scopes").array().notNull(),
    state: oauthGrantState("state").default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    activatedAt: timestamp("activated_at"),
    revokedAt: timestamp("revoked_at"),
    expiresAt: timestamp("expires_at").notNull(),
    lastUsedAt: timestamp("last_used_at"),
  },
  (table) => [
    index("oauth_grant_owner_user_id_idx").on(table.ownerUserId),
    uniqueIndex("oauth_grant_active_authority_uidx")
      .on(table.ownerUserId, table.clientId, table.resource, table.scopes)
      .where(sql`${table.state} = 'active'`),
  ],
);

export const securityEvent = pgTable(
  "security_event",
  {
    id: text("id").primaryKey(),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    credentialId: text("credential_id"),
    grantId: text("grant_id"),
    operation: text("operation").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    result: text("result").notNull(),
    requestId: text("request_id").notNull(),
    details: jsonb("details").$type<Record<string, string | string[]>>(),
  },
  (table) => [
    index("security_event_actor_user_id_idx").on(table.actorUserId),
    index("security_event_request_id_idx").on(table.requestId),
  ],
);
