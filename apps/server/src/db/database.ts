import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export function createDatabase(databaseUrl: string) {
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    max: 10,
  });
  const db = drizzle({ client: pool, schema });

  return {
    check: async () => {
      await db.execute(sql`select 1`);
    },
    close: () => pool.end(),
    db,
  };
}

export type DatabaseRuntime = ReturnType<typeof createDatabase>;
export type Database = DatabaseRuntime["db"];
