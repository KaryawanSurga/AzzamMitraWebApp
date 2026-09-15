import { defineConfig } from "drizzle-kit";
import { readDatabaseUrl } from "./src/config/database-env";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: readDatabaseUrl(),
  },
  strict: true,
  verbose: true,
});
