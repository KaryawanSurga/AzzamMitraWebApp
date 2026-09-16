import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { calculateSale, saleMutationSchema } from "@/domain/sales";
import type { OwnerProfile } from "@/lib/auth/owner";
import { RepositoryConflictError, RepositoryUnavailableError } from "@/server/errors";
import { DrizzleF2Repository } from "@/server/f2/drizzle-repository";
import { applySchema } from "@/test/migrate";
import { DrizzleF3Repository } from "./drizzle-repository";

const owner: OwnerProfile = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "owner@example.com", display_name: "Owner" };
const customerId = "11111111-1111-4111-8111-111111111111";
const saleRaw = { customerId, transactionDate: "2026-09-15", items: [{ description: "Telur", pricingBasis: "crate", crateQuantity: "10", unitPriceRupiah: 100_000 }], discountRupiah: 0, feeRupiah: 0, paymentChoice: "debt", initialPaymentRupiah: 0, dueDate: "2026-09-25", idempotencyKey: "22222222-2222-4222-8222-222222222222", status: "confirmed" } as const;

describe("DrizzleF3Repository with PostgreSQL adapter", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let repository: DrizzleF3Repository;
  let saleId: string;
  let invoiceNumber: string;

  beforeEach(async () => {
    client = new PGlite();
    await applySchema(client);
    await client.exec(`
      insert into auth.users(id) values ('${owner.id}');
      insert into users(id,email,display_name) values ('${owner.id}','${owner.email}','Owner');
      insert into customers(id,customer_number,name,create_idempotency_key) values ('${customerId}','CUS-SEED','Budi','00000000-0000-4000-8000-000000000001');
    `);
    db = drizzle(client, { schema });
    repository = new DrizzleF3Repository(db as unknown as NodePgDatabase<typeof schema>);
    const input = saleMutationSchema.parse(saleRaw);
    const sale = await new DrizzleF2Repository(db as unknown as NodePgDatabase<typeof schema>).createSaleAtomic(input, calculateSale(input, "2026-09-15"), owner);
    saleId = sale.id;
    invoiceNumber = sale.invoiceNumber;
  });
  afterEach(async () => client.close());

  const count = async (table: string) => Number((await db.execute(sql.raw(`select count(*) as count from ${table}`))).rows[0].count);
  const payment = (amountRupiah: number, method: "cash" | "transfer", paidAt: string) => ({ saleId, amountRupiah, method, paidAt, idempotencyKey: crypto.randomUUID() });

  it("mencatat pembayaran bertahap, menghitung ulang status, dan menyimpan audit", async () => {
    const billing = await repository.getSaleBilling(saleId);
    expect(billing).toMatchObject({ invoiceNumber, crateQuantityMilli: 10000, paidRupiah: 0, dueDate: "2026-09-25" });
    if (!billing) return;
    const cash = await repository.createPaymentAtomic(payment(400_000, "cash", "2026-09-15"), billing, "2026-09-15", owner);
    expect(cash).toMatchObject({ amountRupiah: 400_000, method: "cash", paidAt: "2026-09-15" });
    let [sale] = (await db.execute(sql.raw(`select payment_status::text as status from sales where id = '${saleId}'`))).rows;
    expect(sale).toMatchObject({ status: "partial" });
    await repository.createPaymentAtomic(payment(600_000, "transfer", "2026-09-16"), billing, "2026-09-16", owner);
    expect(await repository.listPayments(saleId)).toHaveLength(2);
    [sale] = (await db.execute(sql.raw(`select payment_status::text as status from sales where id = '${saleId}'`))).rows;
    expect(sale).toMatchObject({ status: "paid" });
    expect(await repository.getSaleBilling(saleId)).toMatchObject({ paidRupiah: 1_000_000 });
    expect(await count("audit_events")).toBe(3);
  });

  it("menyerahkan satu pemenang untuk pembayaran dengan kunci idempotensi yang sama", async () => {
    const billing = await repository.getSaleBilling(saleId);
    if (!billing) return;
    const idempotencyKey = crypto.randomUUID();
    const input = { saleId, amountRupiah: 500_000, method: "cash", paidAt: "2026-09-15", idempotencyKey } as const;
    const results = await Promise.allSettled([
      repository.createPaymentAtomic(input, billing, "2026-09-15", owner),
      repository.createPaymentAtomic(input, billing, "2026-09-15", owner),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.find(({ status }) => status === "rejected")).toMatchObject({ reason: expect.any(RepositoryConflictError) });
    expect(await repository.findPaymentByIdempotencyKey(idempotencyKey)).toMatchObject({ amountRupiah: 500_000 });
    expect(await count("payments")).toBe(1);
  });

  it("bergerak dari diantar sebagian ke diterima saat penerimaan bertahap dicatat", async () => {
    const delivery = await repository.createDeliveryAtomic({ saleId, crateQuantity: "10", idempotencyKey: crypto.randomUUID() }, owner);
    expect(delivery).toMatchObject({ status: "unprocessed", crateQuantityMilli: 10000, receivedCrateQuantityMilli: 0 });
    const partial = await repository.updateDeliveryAtomic({ delivery, status: "partially_delivered", receivedCrateQuantityMilli: 6000, receivedAt: null, action: "delivery.partially_received", idempotencyKey: crypto.randomUUID() }, owner);
    expect(partial).toMatchObject({ status: "partially_delivered", receivedCrateQuantityMilli: 6000, receivedAt: null });
    const received = await repository.updateDeliveryAtomic({ delivery: partial, status: "received", receivedCrateQuantityMilli: 10000, receivedAt: "2026-09-16", action: "delivery.received", idempotencyKey: crypto.randomUUID() }, owner);
    expect(received).toMatchObject({ status: "received", receivedCrateQuantityMilli: 10000, receivedAt: "2026-09-16" });
    expect(await repository.listDeliveries(saleId)).toHaveLength(1);
    expect(await repository.plannedCrateQuantityMilli(saleId)).toBe(10000);
  });

  it("menolak penerimaan melebihi rencana pengiriman lewat check constraint", async () => {
    const delivery = await repository.createDeliveryAtomic({ saleId, crateQuantity: "10", idempotencyKey: crypto.randomUUID() }, owner);
    await expect(repository.updateDeliveryAtomic({ delivery, status: "received", receivedCrateQuantityMilli: 11000, receivedAt: "2026-09-16", action: "delivery.received", idempotencyKey: crypto.randomUUID() }, owner)).rejects.toBeInstanceOf(RepositoryUnavailableError);
    expect((await repository.getDelivery(delivery.id))!.receivedCrateQuantityMilli).toBe(0);
  });

  it("menghitung saldo peti dari penjualan dan pengembalian", async () => {
    expect(await repository.getCrateAccount(customerId)).toMatchObject({ customerNumber: "CUS-SEED", balanceMilli: 10000 });
    const returned = await repository.recordCrateReturnAtomic({ customerId, crateQuantity: "6", occurredAt: "2026-09-16", notes: "Peti kosong", idempotencyKey: crypto.randomUUID() }, 10000, owner);
    expect(returned).toMatchObject({ type: "return", crateQuantityMilli: 6000, notes: "Peti kosong" });
    expect(await repository.getCrateAccount(customerId)).toMatchObject({ balanceMilli: 4000 });
    expect(await repository.listCrateBalances({ query: "Budi", limit: 10, offset: 0 })).toEqual([{ customerId, customerNumber: "CUS-SEED", customerName: "Budi", balanceMilli: 4000 }]);
    expect((await repository.listCrateMovements({ customerId, limit: 10, offset: 0 })).map((movement) => movement.type)).toEqual(["return", "out"]);
  });

  it("menghilangkan pelanggan dari daftar ketika semua peti sudah kembali", async () => {
    await repository.recordCrateReturnAtomic({ customerId, crateQuantity: "10", occurredAt: "2026-09-16", idempotencyKey: crypto.randomUUID() }, 10000, owner);
    expect(await repository.getCrateAccount(customerId)).toMatchObject({ balanceMilli: 0 });
    expect(await repository.listCrateBalances({ query: "", limit: 10, offset: 0 })).toEqual([]);
  });

  it("hanya mencatat satu pengembalian untuk kunci idempotensi yang sama", async () => {
    const idempotencyKey = crypto.randomUUID();
    const input = { customerId, crateQuantity: "4", occurredAt: "2026-09-16", idempotencyKey };
    const results = await Promise.allSettled([
      repository.recordCrateReturnAtomic(input, 10000, owner),
      repository.recordCrateReturnAtomic(input, 10000, owner),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(await repository.findCrateMovementByIdempotencyKey(idempotencyKey)).toMatchObject({ crateQuantityMilli: 4000 });
    expect(await repository.getCrateAccount(customerId)).toMatchObject({ balanceMilli: 6000 });
  });
});
