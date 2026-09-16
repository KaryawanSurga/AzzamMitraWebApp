import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";

/* Skema uji dibangun dari migration asli supaya test gagal ketika schema dan kode saling menyimpang. */
export function migrationSql(directory = join(process.cwd(), "drizzle")): string {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(join(directory, name), "utf8").replaceAll("--> statement-breakpoint", ""))
    .join("\n");
}

export async function applySchema(client: PGlite): Promise<void> {
  await client.exec("create schema if not exists auth; create table if not exists auth.users (id uuid primary key);");
  await client.exec(migrationSql());
}
