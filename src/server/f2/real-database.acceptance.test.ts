import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";
import { jakartaDate, saleMutationSchema } from "@/domain/sales";
import type { OwnerProfile } from "@/lib/auth/owner";
import { DrizzleF5Repository } from "@/server/f5/drizzle-repository";
import { F5Service } from "@/server/f5/service";
import { DrizzleF2Repository } from "./drizzle-repository";
import { F2Service } from "./service";

const realDatabase = process.env.DATABASE_UAT === "1" || process.env.npm_lifecycle_event === "uat:db";
const connectionString = realDatabase ? process.env.DATABASE_URL : undefined;

describe.runIf(Boolean(connectionString))("acceptance F6 pada PostgreSQL nyata", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let repository: DrizzleF2Repository;
  let owner: OwnerProfile;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    db = drizzle(pool, { schema });
    repository = new DrizzleF2Repository(db);
    const [profile] = await db.select({ id: schema.users.id, email: schema.users.email, display_name: schema.users.displayName }).from(schema.users).limit(1);
    if (!profile) throw new Error("Profil owner belum tersedia di database UAT.");
    owner = profile;
  });

  afterAll(async () => { await pool.end(); });

  it("menjalankan penjualan, koreksi, pembatalan, audit, dan pelaporan pada database nyata", async () => {
    const service = new F2Service(repository);
    const today = jakartaDate(new Date());
    const customer = await repository.createCustomer({ idempotencyKey: crypto.randomUUID(), name: `UAT F6 ${Date.now()}` }, owner);
    const raw = saleMutationSchema.parse({
      customerId: customer.id, transactionDate: today, items: [{ description: "UAT F6 telur", pricingBasis: "crate", crateQuantity: "1", unitPriceRupiah: 100_000 }],
      discountRupiah: 0, feeRupiah: 0, paymentChoice: "down_payment", initialPaymentRupiah: 25_000, paymentMethod: "cash", dueDate: today, idempotencyKey: crypto.randomUUID(), status: "confirmed",
    });
    const created = await service.createSale(raw, owner);
    if (!created.ok) throw new Error(`createSale gagal: ${created.error.message}`);

    const corrected = await service.correctSale({ saleId: created.data.id, discountRupiah: 10_000, dueDate: today, reason: "UAT koreksi diskon", idempotencyKey: crypto.randomUUID() }, owner);
    expect(corrected).toMatchObject({ ok: true, data: { totalRupiah: 90_000 } });

    const cancelled = await service.cancelSale({ saleId: created.data.id, reason: "UAT pembatalan invoice", idempotencyKey: crypto.randomUUID() }, owner);
    expect(cancelled).toMatchObject({ ok: true, data: { status: "cancelled" } });

    const retry = await service.cancelSale({ saleId: created.data.id, reason: "UAT pembatalan invoice", idempotencyKey: crypto.randomUUID() }, owner);
    expect(retry).toMatchObject({ ok: false, error: { code: "conflict" } });

    const history = await service.getSaleHistory({ id: created.data.id }, owner);
    expect(history).toMatchObject({
      ok: true,
      data: {
        adjustments: [{ type: "cancellation" }, { type: "correction" }],
        auditEvents: [{ action: "sale.cancelled" }, { action: "sale.corrected" }, { action: "sale.confirmed" }],
      },
    });

    const report = await new F5Service(new DrizzleF5Repository(db)).getPeriodReport({ from: today, to: today }, owner);
    if (!report.ok) throw new Error(`getPeriodReport gagal: ${report.error.message}`);
    expect(report.data.rows.some((row) => row.reference === created.data.invoiceNumber)).toBe(false);

    const invoiceRows = await db.select({ status: schema.sales.status, cancelledAt: schema.sales.cancelledAt }).from(schema.sales).where(eq(schema.sales.id, created.data.id));
    expect(invoiceRows).toEqual([{ status: "cancelled", cancelledAt: expect.any(Date) }]);
  });

  it("UAT-11: menerima backdate tepat satu tahun dan menolak yang lebih lama atau masa depan", async () => {
    const service = new F2Service(repository);
    const today = jakartaDate(new Date());
    const [year, month, day] = today.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year - 1, month, 0)).getUTCDate();
    const minimum = `${year - 1}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
    const previousDay = (value: string) => { const date = new Date(`${value}T00:00:00+07:00`); date.setUTCDate(date.getUTCDate() - 1); return jakartaDate(date); };
    const nextDay = (value: string) => { const date = new Date(`${value}T00:00:00+07:00`); date.setUTCDate(date.getUTCDate() + 1); return jakartaDate(date); };

    const customer = await repository.createCustomer({ idempotencyKey: crypto.randomUUID(), name: `UAT Backdate ${Date.now()}` }, owner);
    const base = {
      customerId: customer.id, items: [{ description: "UAT backdate", pricingBasis: "crate", crateQuantity: "1", unitPriceRupiah: 50_000 }],
      discountRupiah: 0, feeRupiah: 0, paymentChoice: "full", paymentMethod: "cash", idempotencyKey: crypto.randomUUID(), status: "confirmed",
    } as const;

    const accepted = await service.createSale({ ...base, transactionDate: minimum, idempotencyKey: crypto.randomUUID() }, owner);
    expect(accepted).toMatchObject({ ok: true });

    const tooOld = await service.createSale({ ...base, transactionDate: previousDay(minimum), idempotencyKey: crypto.randomUUID() }, owner);
    expect(tooOld).toMatchObject({ ok: false, error: { code: "validation", fields: { transactionDate: [expect.stringContaining("satu tahun")] } } });

    const future = await service.createSale({ ...base, transactionDate: nextDay(today), idempotencyKey: crypto.randomUUID() }, owner);
    expect(future).toMatchObject({ ok: false, error: { code: "validation", fields: { transactionDate: [expect.stringContaining("masa depan")] } } });
  });
});
