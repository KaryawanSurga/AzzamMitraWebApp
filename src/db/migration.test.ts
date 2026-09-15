import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const applicationTables = [
  "users", "customers", "sales", "sale_items", "payments", "deliveries",
  "crate_movements", "expenses", "capital_movements", "adjustments", "audit_events",
];

describe("secure migration baseline", () => {
  const migrationDirectory = join(process.cwd(), "drizzle");
  const migrations = readdirSync(migrationDirectory)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const initialMigration = readFileSync(join(migrationDirectory, migrations[0]), "utf8");
  const sql = migrations.map((name) => readFileSync(join(migrationDirectory, name), "utf8")).join("\n");

  it.each(applicationTables)("enables row-level security for public.%s in the initial migration", (table) => {
    expect(initialMigration).toMatch(new RegExp(`ALTER TABLE \\"${table}\\" ENABLE ROW LEVEL SECURITY`));
  });

  it("does not create browser-access policies during F1", () => {
    expect(sql).not.toMatch(/CREATE\s+POLICY/i);
  });
});
