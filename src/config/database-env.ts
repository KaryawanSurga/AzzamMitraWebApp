import { z } from "zod";

const databaseUrlSchema = z
  .url("DATABASE_URL harus berupa PostgreSQL URL yang valid.")
  .refine((url) => url.startsWith("postgres://") || url.startsWith("postgresql://"), {
    message: "DATABASE_URL harus menggunakan protokol postgres:// atau postgresql://.",
  });

export function readDatabaseUrl(): string {
  return databaseUrlSchema.parse(process.env.DATABASE_URL);
}
