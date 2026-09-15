import "server-only";
import { readDatabaseUrl } from "./database-env";

export function getDatabaseUrl(): string {
  return readDatabaseUrl();
}
