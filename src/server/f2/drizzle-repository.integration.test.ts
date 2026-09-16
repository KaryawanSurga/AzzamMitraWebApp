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

const owner: OwnerProfile = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "owner@example.com", display_name: "Owner" };
const customerId = "11111111-1111-4111-8111-111111111111";
const saleRaw = { customerId, transactionDate: "2026-09-15", items: [{ description: "Telur", pricingBasis: "crate", crateQuantity: "2", unitPriceRupiah: 100000 }], discountRupiah: 0, feeRupiah: 0, paymentChoice: "down_payment", initialPaymentRupiah: 50000, paymentMethod: "cash", dueDate: "2026-09-16", idempotencyKey: "22222222-2222-4222-8222-222222222222", status: "confirmed" } as const;

describe("DrizzleF2Repository with PostgreSQL adapter", () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let repository: DrizzleF2Repository;

  beforeEach(async () => {
    client = new PGlite();
    await client.exec(`
      create type sale_status as enum ('draft','confirmed','completed','cancelled');
      create type payment_status as enum ('unpaid','partial','paid','due','overdue','refunded');
      create type pricing_basis as enum ('crate','kg');
      create type payment_method as enum ('cash','transfer','other');
      create table users (id uuid primary key, email text not null, display_name text not null, created_at timestamptz default now() not null, updated_at timestamptz default now() not null);
      create table customers (id uuid default gen_random_uuid() primary key, customer_number text not null unique, name text not null, whatsapp text, address text, notes text, is_active boolean default true not null, create_idempotency_key text not null unique, created_at timestamptz default now() not null, updated_at timestamptz default now() not null);
      create table sales (id uuid default gen_random_uuid() primary key, invoice_number text not null unique, idempotency_key text not null unique, customer_id uuid not null references customers(id), status sale_status not null, payment_status payment_status not null, transaction_date timestamptz not null, due_date date, subtotal_rupiah bigint not null, discount_rupiah bigint not null, fee_rupiah bigint not null, total_rupiah bigint not null, notes text, confirmed_at timestamptz, cancelled_at timestamptz, created_at timestamptz default now() not null, updated_at timestamptz default now() not null);
      create table sale_items (id uuid default gen_random_uuid() primary key, sale_id uuid not null references sales(id), description_snapshot text not null, pricing_basis pricing_basis not null, unit_snapshot text not null, crate_quantity numeric(12,3), weight_kg numeric(12,3), pricing_quantity numeric(12,3) not null, unit_price_rupiah bigint not null, subtotal_rupiah bigint not null, created_at timestamptz default now() not null);
      create table payments (id uuid default gen_random_uuid() primary key, payment_number text not null unique, sale_id uuid not null references sales(id), amount_rupiah bigint not null, method payment_method not null, paid_at timestamptz not null, notes text, idempotency_key text not null unique, created_at timestamptz default now() not null);
      create table audit_events (id uuid default gen_random_uuid() primary key, event_number text not null unique, idempotency_key text unique, actor_id uuid not null references users(id), entity_type text not null, entity_id uuid not null, action text not null, before jsonb, after jsonb, reason text, occurred_at timestamptz default now() not null);
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
});
