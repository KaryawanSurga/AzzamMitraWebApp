import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

function readMigration(name: string): string {
  return readFileSync(join(process.cwd(), "drizzle", name), "utf8").replaceAll("--> statement-breakpoint", "");
}

describe("F4 migration upgrade path", () => {
  let client: PGlite | undefined;

  afterEach(async () => {
    await client?.close();
  });

  it("backfills legacy finance rows before enforcing idempotency constraints", async () => {
    client = new PGlite();
    await client.exec("create schema auth; create table auth.users (id uuid primary key);");

    for (const migration of [
      "0000_crazy_malcolm_colcord.sql",
      "0001_serious_franklin_richards.sql",
      "0002_flawless_thor.sql",
      "0003_old_electro.sql",
      "0004_grey_elektra.sql",
    ]) {
      await client.exec(readMigration(migration));
    }

    await client.exec(`
      insert into expenses (expense_number, category, amount_rupiah, occurred_at)
      values ('EXP-LEGACY-1', 'egg_purchase', 100000, '2026-01-01T00:00:00Z'),
             ('EXP-LEGACY-2', 'delivery', 50000, '2026-01-02T00:00:00Z');
      insert into capital_movements (movement_number, type, amount_rupiah, occurred_at)
      values ('CAP-LEGACY-1', 'capital_in', 200000, '2026-01-01T00:00:00Z'),
             ('CAP-LEGACY-2', 'owner_draw', 75000, '2026-01-02T00:00:00Z');
    `);

    await client.exec(readMigration("0005_fat_venom.sql"));

    const expenses = await client.query<{ idempotency_key: string }>("select idempotency_key from expenses order by expense_number");
    const capitalMovements = await client.query<{ idempotency_key: string }>("select idempotency_key from capital_movements order by movement_number");
    const expenseKeys = expenses.rows.map((row) => row.idempotency_key);
    const capitalKeys = capitalMovements.rows.map((row) => row.idempotency_key);
    const keys = [...expenseKeys, ...capitalKeys];
    expect(keys).toHaveLength(4);
    expect(keys.every((key) => key.startsWith("legacy:"))).toBe(true);
    expect(new Set(keys).size).toBe(4);

    await expect(client.exec(`
      insert into expenses (expense_number, category, amount_rupiah, occurred_at, idempotency_key)
      values ('EXP-NULL', 'other', 1, '2026-01-03T00:00:00Z', null)
    `)).rejects.toThrow(/not-null constraint/i);
    await expect(client.exec(`
      insert into capital_movements (movement_number, type, amount_rupiah, occurred_at, idempotency_key)
      values ('CAP-NULL', 'capital_in', 1, '2026-01-03T00:00:00Z', null)
    `)).rejects.toThrow(/not-null constraint/i);

    await expect(client.exec(`
      insert into expenses (expense_number, category, amount_rupiah, occurred_at, idempotency_key)
      values ('EXP-DUP', 'other', 1, '2026-01-03T00:00:00Z', '${expenseKeys[0]}')
    `)).rejects.toThrow(/unique constraint/i);
    await expect(client.exec(`
      insert into capital_movements (movement_number, type, amount_rupiah, occurred_at, idempotency_key)
      values ('CAP-DUP', 'capital_in', 1, '2026-01-03T00:00:00Z', '${capitalKeys[0]}')
    `)).rejects.toThrow(/unique constraint/i);
  });
});
