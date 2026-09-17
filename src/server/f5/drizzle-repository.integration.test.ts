import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { applySchema } from "@/test/migrate";
import { DrizzleF5Repository } from "./drizzle-repository";

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
      insert into sales(id,invoice_number,idempotency_key,customer_id,status,transaction_date)
      values ('22222222-2222-4222-8222-222222222222','INV-REPORT','00000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','confirmed','2026-09-01T00:00:00Z');
      insert into payments(payment_number,sale_id,amount_rupiah,method,paid_at,idempotency_key) values
        ('PAY-OUT','22222222-2222-4222-8222-222222222222',90000,'cash','2026-09-10T01:00:00Z','00000000-0000-4000-8000-000000000003'),
        ('PAY-IN-1','22222222-2222-4222-8222-222222222222',400000,'cash','2026-09-16T02:00:00Z','00000000-0000-4000-8000-000000000004'),
        ('PAY-IN-2','22222222-2222-4222-8222-222222222222',600000,'transfer','2026-09-17T03:00:00Z','00000000-0000-4000-8000-000000000005');
      insert into expenses(expense_number,idempotency_key,category,amount_rupiah,occurred_at) values
        ('EXP-OUT','00000000-0000-4000-8000-000000000006','other',50000,'2026-09-10T01:00:00Z'),
        ('EXP-IN','00000000-0000-4000-8000-000000000007','fuel_toll_parking',150000,'2026-09-16T04:00:00Z');
      insert into capital_movements(movement_number,idempotency_key,type,amount_rupiah,occurred_at)
      values ('CAP-IGNORED','00000000-0000-4000-8000-000000000008','capital_in',2000000,'2026-09-16T05:00:00Z');
    `);
    const db = drizzle(client, { schema });
    repository = new DrizzleF5Repository(db as unknown as NodePgDatabase<typeof schema>);
  });

  afterEach(async () => client.close());

  it("mengambil uang masuk dan biaya dalam periode tanpa modal", async () => {
    const from = new Date("2026-09-15T17:00:00.000Z");
    const to = new Date("2026-09-17T16:59:59.999Z");
    const [income, expenses] = await Promise.all([
      repository.listIncomeEvents(from, to),
      repository.listExpenseEvents(from, to),
    ]);

    expect(income.map(({ amountRupiah }) => amountRupiah)).toEqual([400_000, 600_000]);
    expect(expenses.map(({ amountRupiah }) => amountRupiah)).toEqual([150_000]);
  });
});
