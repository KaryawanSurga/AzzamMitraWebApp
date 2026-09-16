import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { OwnerProfile } from "@/lib/auth/owner";
import { applySchema } from "@/test/migrate";
import { RepositoryConflictError } from "./repository";
import { DrizzleF4Repository } from "./drizzle-repository";

const owner: OwnerProfile = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "owner@example.com", display_name: "Owner" };
describe("DrizzleF4Repository with PostgreSQL adapter", () => {
  let client: PGlite; let db: ReturnType<typeof drizzle<typeof schema>>; let repository: DrizzleF4Repository;
  const count = async (table: string) => Number((await db.execute(sql.raw(`select count(*) as count from ${table}`))).rows[0].count);
  beforeEach(async () => { client = new PGlite(); await applySchema(client); await client.exec(`insert into auth.users(id) values ('${owner.id}'); insert into users(id,email,display_name) values ('${owner.id}','${owner.email}','Owner');`); db = drizzle(client, { schema }); repository = new DrizzleF4Repository(db as unknown as NodePgDatabase<typeof schema>); });
  afterEach(async () => client.close());

  it("commit pengeluaran dan audit secara atomik tanpa membuat stok/HPP", async () => {
    const key = crypto.randomUUID(); const result = await repository.createExpenseAtomic({ category: "egg_purchase", amountRupiah: 1_000_000, method: "transfer", occurredAt: "2026-09-17T08:00:00+07:00", notes: "Telur", idempotencyKey: key }, owner);
    expect(result).toMatchObject({ category: "egg_purchase", amountRupiah: 1_000_000 }); expect(await repository.findExpenseByIdempotencyKey(key)).toEqual(result);
    expect(await Promise.all([count("expenses"), count("capital_movements"), count("sales"), count("audit_events")])).toEqual([1, 0, 0, 1]);
  });
  it("rollback record ketika foreign key audit gagal", async () => {
    await expect(repository.createExpenseAtomic({ category: "loading", amountRupiah: 1, occurredAt: "2026-09-17T08:00:00+07:00", idempotencyKey: crypto.randomUUID() }, { ...owner, id: crypto.randomUUID() })).rejects.toBeDefined();
    expect(await Promise.all([count("expenses"), count("audit_events")])).toEqual([0, 0]);
  });
  it("menyerahkan satu pemenang pada duplicate submit concurrent", async () => {
    const input = { type: "capital_in", amountRupiah: 2_000_000, occurredAt: "2026-09-17T09:00:00+07:00", idempotencyKey: crypto.randomUUID() } as const;
    const results = await Promise.allSettled([repository.createCapitalMovementAtomic(input, owner), repository.createCapitalMovementAtomic(input, owner)]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1); expect(results.find(({ status }) => status === "rejected")).toMatchObject({ reason: expect.any(RepositoryConflictError) });
    expect(await Promise.all([count("capital_movements"), count("expenses"), count("payments"), count("audit_events")])).toEqual([1, 0, 0, 1]);
  });
  it("mengurutkan terbaru, memfilter periode, dan menjaga koleksi terpisah", async () => {
    await repository.createExpenseAtomic({ category: "delivery", amountRupiah: 10, occurredAt: "2026-09-16T08:00:00+07:00", idempotencyKey: crypto.randomUUID() }, owner);
    await repository.createExpenseAtomic({ category: "wages", amountRupiah: 20, occurredAt: "2026-09-17T08:00:00+07:00", idempotencyKey: crypto.randomUUID() }, owner);
    await repository.createCapitalMovementAtomic({ type: "owner_draw", amountRupiah: 30, occurredAt: "2026-09-17T09:00:00+07:00", idempotencyKey: crypto.randomUUID() }, owner);
    expect((await repository.listExpenses({ from: "2026-09-17T00:00:00+07:00", limit: 50, offset: 0 })).map(({ category }) => category)).toEqual(["wages"]);
    expect((await repository.listCapitalMovements({ limit: 50, offset: 0 })).map(({ type }) => type)).toEqual(["owner_draw"]);
  });
});
