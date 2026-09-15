import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getDatabaseUrl } from "@/config/env.server";
import * as schema from "./schema";

let database: NodePgDatabase<typeof schema> | undefined;

export function getDatabase(): NodePgDatabase<typeof schema> {
  if (!database) {
    const pool = new Pool({ connectionString: getDatabaseUrl() });
    database = drizzle(pool, { schema });
  }

  return database;
}
