import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { periodReportCsv } from "@/domain/reports";
import * as schema from "@/db/schema";
import type { OwnerProfile } from "@/lib/auth/owner";
import { applySchema } from "@/test/migrate";
import { DrizzleF5Repository } from "./drizzle-repository";
import { F5Service } from "./service";

describe("DrizzleF5Repository with PostgreSQL adapter", () => {
  let client: PGlite;
  let repository: DrizzleF5Repository;

  beforeEach(async () => {
    client = new PGlite();
    await applySchema(client);
    await client.exec(`
      insert into auth.users(id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
      insert into users(id,email,display_name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner@example.com','Owner');
      insert into customers(id,customer_number,name,create_idempotency_key)
      values ('11111111-1111-4111-8111-111111111111','CUS-REPORT','Budi','00000000-0000-4000-8000-000000000001');
      insert into sales(id,invoice_number,idempotency_key,customer_id,status,payment_status,transaction_date,due_date,subtotal_rupiah,total_rupiah)
      values ('22222222-2222-4222-8222-222222222222','INV-REPORT','00000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','confirmed','partial','2026-09-16T02:00:00Z','2026-09-16',1500000,1500000);
      insert into sale_items(sale_id,description_snapshot,pricing_basis,unit_snapshot,crate_quantity,pricing_quantity,unit_price_rupiah,subtotal_rupiah)
      values ('22222222-2222-4222-8222-222222222222','Telur','crate','peti',10,10,150000,1500000);
      insert into payments(payment_number,sale_id,amount_rupiah,method,paid_at,idempotency_key) values
        ('PAY-IN-1','22222222-2222-4222-8222-222222222222',400000,'cash','2026-09-16T03:00:00Z','00000000-0000-4000-8000-000000000003'),
        ('PAY-IN-2','22222222-2222-4222-8222-222222222222',600000,'transfer','2026-09-17T03:00:00Z','00000000-0000-4000-8000-000000000004');
      insert into deliveries(id,delivery_number,sale_id,status,crate_quantity,received_crate_quantity,idempotency_key)
      values ('33333333-3333-4333-8333-333333333333','DLV-REPORT','22222222-2222-4222-8222-222222222222','partially_delivered',10,6,'00000000-0000-4000-8000-000000000005');
      insert into crate_movements(movement_number,customer_id,sale_id,type,quantity,occurred_at,idempotency_key) values
        ('CRT-OUT','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','out',10,'2026-09-16T02:00:00Z','00000000-0000-4000-8000-000000000006'),
        ('CRT-RETURN','11111111-1111-4111-8111-111111111111',null,'return',6,'2026-09-17T04:00:00Z','00000000-0000-4000-8000-000000000007');
      insert into expenses(expense_number,idempotency_key,category,amount_rupiah,occurred_at,notes) values
        ('EXP-IN','00000000-0000-4000-8000-000000000008','fuel_toll_parking',150000,'2026-09-16T04:00:00Z','Antar pesanan'),
        ('EXP-OUT','00000000-0000-4000-8000-000000000009','other',50000,'2026-09-10T01:00:00Z',null);
      insert into capital_movements(movement_number,idempotency_key,type,amount_rupiah,occurred_at)
      values ('CAP-IGNORED','00000000-0000-4000-8000-000000000010','capital_in',2000000,'2026-09-16T05:00:00Z');
    `);
    const db = drizzle(client, { schema });
    repository = new DrizzleF5Repository(db as unknown as NodePgDatabase<typeof schema>);
  });

  afterEach(async () => client.close());

  it("mengambil penjualan, pembayaran, dan biaya dalam periode tanpa modal", async () => {
    const from = new Date("2026-09-15T17:00:00.000Z");
    const to = new Date("2026-09-17T16:59:59.999Z");
    const [sales, payments, expenses] = await Promise.all([
      repository.listSales(from, to),
      repository.listPayments(from, to),
      repository.listExpenses(from, to),
    ]);

    expect(sales.map(({ amountRupiah }) => amountRupiah)).toEqual([1_500_000]);
    expect(payments.map(({ amountRupiah }) => amountRupiah)).toEqual([400_000, 600_000]);
    expect(expenses.map(({ amountRupiah }) => amountRupiah)).toEqual([150_000]);
  });

  it("menghitung piutang pada akhir periode dari pembayaran sampai tanggal tersebut", async () => {
    const receivables = await repository.listReceivables(new Date("2026-09-17T16:59:59.999Z"));
    expect(receivables).toEqual([expect.objectContaining({
      invoiceNumber: "INV-REPORT",
      customerName: "Budi",
      dueDate: "2026-09-16",
      outstandingRupiah: 500_000,
    })]);
  });

  it("menemukan sisa pengiriman dan peti pelanggan", async () => {
    const [undelivered, crates] = await Promise.all([
      repository.listUndelivered(),
      repository.listCrateOutstanding(),
    ]);
    expect(undelivered).toEqual([expect.objectContaining({ invoiceNumber: "INV-REPORT", outstandingCrateMilli: 4_000 })]);
    expect(crates).toEqual([expect.objectContaining({ customerName: "Budi", balanceMilli: 4_000 })]);
  });

  it("UAT-09: laporan periode dari transaksi campuran tanpa modal atau metrik stok", async () => {
    const owner: OwnerProfile = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      email: "owner@example.com",
      display_name: "Owner",
    };
    const service = new F5Service(repository, () => new Date("2026-09-18T10:00:00+07:00"));
    const result = await service.getPeriodReport({ from: "2026-09-01", to: "2026-09-17" }, owner);
    if (!result.ok) throw new Error("laporan periode seharusnya berhasil");

    expect(result.data).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-17",
      totalSalesRupiah: 1_500_000,
      totalIncomeRupiah: 1_000_000,
      totalExpenseRupiah: 200_000,
      netCashflowRupiah: 800_000,
      totalReceivablesRupiah: 500_000,
      otherIncomeRupiah: 0,
      estimatedNetProfitRupiah: 1_300_000,
    });
    expect(result.data.rows.map(({ type }) => type).sort()).toEqual(["expense", "expense", "payment", "payment", "sale"]);

    const csv = periodReportCsv(result.data);
    expect(csv).toContain('"Penjualan bersih","1500000"');
    expect(csv).toContain('"Uang masuk","1000000"');
    expect(csv).toContain('"Pengeluaran","200000"');
    expect(csv).toContain('"Estimasi laba bersih","1300000"');
    expect(csv).not.toContain("2000000");
  });

  it("mengeluarkan invoice batal dari omzet, uang masuk, dan piutang", async () => {
    await client.exec("update sales set status = 'cancelled', cancelled_at = now() where invoice_number = 'INV-REPORT'");
    const balance = await repository.listSales(new Date("2026-09-15T17:00:00.000Z"), new Date("2026-09-17T16:59:59.999Z"));
    const payments = await repository.listPayments(new Date("2026-09-15T17:00:00.000Z"), new Date("2026-09-17T16:59:59.999Z"));
    const receivables = await repository.listReceivables(new Date("2026-09-17T16:59:59.999Z"));
    expect(balance).toEqual([]);
    expect(payments).toEqual([]);
    expect(receivables).toEqual([]);
  });
});
