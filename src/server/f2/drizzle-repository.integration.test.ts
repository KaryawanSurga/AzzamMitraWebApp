import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { OwnerProfile } from "@/lib/auth/owner";
import { calculateSale, saleMutationSchema } from "@/domain/sales";
import { DrizzleF2Repository } from "./drizzle-repository";
import { RepositoryConflictError } from "./repository";
import { applySchema } from "@/test/migrate";

const owner: OwnerProfile = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "owner@example.com", display_name: "Owner" };
const customerId = "11111111-1111-4111-8111-111111111111";
const saleRaw = { customerId, transactionDate: "2026-09-15", items: [{ description: "Telur", pricingBasis: "crate", crateQuantity: "2", unitPriceRupiah: 100000 }], discountRupiah: 0, feeRupiah: 0, paymentChoice: "down_payment", initialPaymentRupiah: 50000, paymentMethod: "cash", dueDate: "2026-09-16", idempotencyKey: "22222222-2222-4222-8222-222222222222", status: "confirmed" } as const;

describe("DrizzleF2Repository with PostgreSQL adapter", () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let repository: DrizzleF2Repository;

  beforeEach(async () => {
    client = new PGlite();
    await applySchema(client);
    await client.exec(`
      insert into auth.users(id) values ('${owner.id}');
      insert into users(id,email,display_name) values ('${owner.id}','${owner.email}','Owner');
      insert into customers(id,customer_number,name,create_idempotency_key) values ('${customerId}','CUS-SEED','Seed','00000000-0000-4000-8000-000000000001');
    `);
    db = drizzle(client, { schema });
    repository = new DrizzleF2Repository(db as unknown as NodePgDatabase<typeof schema>);
  });
  afterEach(async () => client.close());

  it("menyimpan sale, item, payment, dan audit secara atomik serta menghitung status saat read", async () => {
    const input = saleMutationSchema.parse(saleRaw); await repository.createSaleAtomic(input, calculateSale(input, "2026-09-15"), owner);
    expect(await repository.findSaleByIdempotencyKey(input.idempotencyKey, "2026-09-17")).toMatchObject({ paymentStatus: "overdue", status: "confirmed", dueDate: "2026-09-16" });
    const counts = await Promise.all(["sales", "sale_items", "payments", "audit_events"].map(async (table) => Number((await db.execute(sql.raw(`select count(*) as count from ${table}`))).rows[0].count)));
    expect(counts).toEqual([1, 1, 1, 1]);
  });

  it("rollback seluruh sale ketika audit gagal", async () => {
    const input = saleMutationSchema.parse(saleRaw); await expect(repository.createSaleAtomic(input, calculateSale(input), { ...owner, id: crypto.randomUUID() })).rejects.toBeDefined();
    const counts = await Promise.all(["sales", "sale_items", "payments", "audit_events"].map(async (table) => Number((await db.execute(sql.raw(`select count(*) as count from ${table}`))).rows[0].count)));
    expect(counts).toEqual([0, 0, 0, 0]);
  });

  it("unique constraint memenangkan satu concurrent create pelanggan", async () => {
    const input = { name: "Budi", idempotencyKey: crypto.randomUUID() };
    const results = await Promise.allSettled([repository.createCustomer(input, owner), repository.createCustomer(input, owner)]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(({ status }) => status === "rejected"); expect(rejected).toMatchObject({ reason: expect.any(RepositoryConflictError) });
    expect(await repository.findCustomerByIdempotencyKey(input.idempotencyKey)).toMatchObject({ name: "Budi" });
  });
  it("mencatat peti keluar saat penjualan dikonfirmasi dan tidak mencatatnya untuk draft", async () => {
    const confirmed = saleMutationSchema.parse(saleRaw);
    await repository.createSaleAtomic(confirmed, calculateSale(confirmed, "2026-09-15"), owner);
    const [confirmedRows, draftRows] = await Promise.all([
      db.execute(sql.raw("select type, quantity::text as quantity, reason from crate_movements")),
      (async () => {
        const draft = saleMutationSchema.parse({ ...saleRaw, status: "draft", paymentChoice: "debt", initialPaymentRupiah: 0, paymentMethod: undefined, dueDate: undefined, idempotencyKey: crypto.randomUUID() });
        await repository.createSaleAtomic(draft, calculateSale(draft, "2026-09-15"), owner);
        return db.execute(sql.raw("select count(*) as count from crate_movements"));
      })(),
    ]);
    expect(confirmedRows.rows).toEqual([{ type: "out", quantity: "2.000", reason: null }]);
    expect(Number(draftRows.rows[0].count)).toBe(1);
  });

  it("UAT-10: membatalkan invoice secara atomik dengan adjustment dan audit", async () => {
    const input = saleMutationSchema.parse(saleRaw);
    const created = await repository.createSaleAtomic(input, calculateSale(input, "2026-09-15"), owner);
    const key = crypto.randomUUID();
    const cancelled = await repository.cancelSaleAtomic({ saleId: created.id, idempotencyKey: key, reason: "Pelanggan membatalkan" }, owner, "2026-09-17");

    expect(cancelled).toMatchObject({ invoiceNumber: created.invoiceNumber, status: "cancelled", totalRupiah: 200_000, paidRupiah: 50_000, remainingRupiah: 150_000 });
    expect(await repository.findAdjustmentByIdempotencyKey(key)).toEqual({ saleId: created.id });
    const [detail, auditRows] = await Promise.all([
      repository.getSale(created.id, "2026-09-17"),
      db.execute(sql.raw("select action, reason, before, after from audit_events where action = 'sale.cancelled'")),
    ]);
    expect(detail).toMatchObject({ invoiceNumber: created.invoiceNumber, status: "cancelled", cancelledAt: expect.any(String) });
    expect(auditRows.rows).toEqual([expect.objectContaining({ action: "sale.cancelled", reason: "Pelanggan membatalkan", before: expect.objectContaining({ status: "confirmed", totalRupiah: 200_000 }), after: expect.objectContaining({ status: "cancelled", totalRupiah: 200_000 }) })]);
    expect(await repository.listSaleAdjustments(created.id)).toMatchObject([{ type: "cancellation", amountRupiah: 200_000, reason: "Pelanggan membatalkan", actorName: "Owner" }]);
  });

  it("menolak kunci idempotensi pembatalan yang dipakai ulang", async () => {
    const input = saleMutationSchema.parse(saleRaw);
    const created = await repository.createSaleAtomic(input, calculateSale(input, "2026-09-15"), owner);
    const key = crypto.randomUUID();
    await repository.cancelSaleAtomic({ saleId: created.id, idempotencyKey: key, reason: "Pelanggan membatalkan" }, owner, "2026-09-17");
    await expect(repository.cancelSaleAtomic({ saleId: created.id, idempotencyKey: key, reason: "Pelanggan membatalkan" }, owner, "2026-09-17")).rejects.toBeInstanceOf(RepositoryConflictError);
  });

  it("UAT-10: mengoreksi nominal invoice dan menyimpan perubahan di audit", async () => {
    const input = saleMutationSchema.parse(saleRaw);
    const created = await repository.createSaleAtomic(input, calculateSale(input, "2026-09-15"), owner);
    const corrected = await repository.correctSaleAtomic({ saleId: created.id, idempotencyKey: crypto.randomUUID(), reason: "Diskon disepakati ulang", discountRupiah: 20_000, feeRupiah: 5_000, totalRupiah: 185_000, dueDate: "2026-09-20", notes: "Revisi", changes: ["diskon", "biaya"] }, owner, "2026-09-17");

    expect(corrected).toMatchObject({ invoiceNumber: created.invoiceNumber, status: "confirmed", totalRupiah: 185_000, dueDate: "2026-09-20" });
    const auditRows = await db.execute(sql.raw("select before, after, reason from audit_events where action = 'sale.corrected'"));
    expect(auditRows.rows).toEqual([expect.objectContaining({ reason: "Diskon disepakati ulang", before: expect.objectContaining({ discountRupiah: 0, totalRupiah: 200_000 }), after: expect.objectContaining({ discountRupiah: 20_000, feeRupiah: 5_000, totalRupiah: 185_000, changes: ["diskon", "biaya"] }) })]);
    expect(await repository.listSaleAdjustments(created.id)).toMatchObject([{ type: "correction", amountRupiah: 15_000 }]);
    expect(await repository.getSale(created.id, "2026-09-17")).toMatchObject({ totalRupiah: 185_000, remainingRupiah: 135_000, notes: "Revisi" });
  });
});
