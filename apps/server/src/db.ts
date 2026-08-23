import { env } from "@taskome/env/server";

import { createDatabase } from "@/db/database";

export const database = createDatabase(env.DATABASE_URL);
export const db = database.db;
