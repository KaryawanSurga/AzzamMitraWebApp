import { describe, expect, it } from "vitest";
import type { CapitalMovementCreateInput, CapitalMovementRecord, ExpenseCreateInput, ExpenseRecord, FinanceListInput } from "@/domain/finance";
import type { OwnerProfile } from "@/lib/auth/owner";
import { RepositoryConflictError } from "./repository";
import type { F4Repository } from "./repository";
import { F4Service } from "./service";

const owner: OwnerProfile = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "owner@example.com", display_name: "Owner" };
const occurredAt = "2026-09-17T08:00:00+07:00";
class FakeRepository implements F4Repository {
  expenses = new Map<string, ExpenseRecord>(); capital = new Map<string, CapitalMovementRecord>(); conflictOnce = false;
  async findExpenseByIdempotencyKey(key: string) { return this.expenses.get(key) ?? null; }
  async createExpenseAtomic(input: ExpenseCreateInput) { const record = { id: crypto.randomUUID(), expenseNumber: "EXP-1", category: input.category, amountRupiah: input.amountRupiah, method: input.method ?? null, occurredAt: new Date(input.occurredAt).toISOString(), notes: input.notes ?? null }; this.expenses.set(input.idempotencyKey, record); if (this.conflictOnce) { this.conflictOnce = false; throw new RepositoryConflictError(); } return record; }
  async listExpenses(input: FinanceListInput) { void input; return [...this.expenses.values()]; }
  async findCapitalMovementByIdempotencyKey(key: string) { return this.capital.get(key) ?? null; }
  async createCapitalMovementAtomic(input: CapitalMovementCreateInput) { const record = { id: crypto.randomUUID(), movementNumber: "CAP-1", type: input.type, amountRupiah: input.amountRupiah, occurredAt: new Date(input.occurredAt).toISOString(), notes: input.notes ?? null }; this.capital.set(input.idempotencyKey, record); return record; }
  async listCapitalMovements(input: FinanceListInput) { void input; return [...this.capital.values()]; }
}

describe("F4Service", () => {
  const expense = { category: "delivery", amountRupiah: 50_000, occurredAt, idempotencyKey: "11111111-1111-4111-8111-111111111111" } as const;
  it("menolak seluruh operasi tanpa owner", async () => {
    const service = new F4Service(new FakeRepository());
    expect(await service.createExpense(expense, null)).toMatchObject({ ok: false, error: { code: "unauthorized" } });
    expect(await service.listCapitalMovements({}, null)).toMatchObject({ ok: false, error: { code: "unauthorized" } });
  });
  it("memberi field error untuk nominal dan batas tanggal", async () => {
    const service = new F4Service(new FakeRepository(), () => new Date("2026-09-17T10:00:00+07:00"));
    expect(await service.createExpense({ ...expense, amountRupiah: 0 }, owner)).toMatchObject({ ok: false, error: { code: "validation", fields: { amountRupiah: expect.any(Array) } } });
    expect(await service.createExpense({ ...expense, occurredAt: "2025-09-17T09:59:59+07:00" }, owner)).toMatchObject({ ok: false, error: { fields: { occurredAt: expect.any(Array) } } });
  });
  it("mengembalikan hasil awal pada replay dan race unique", async () => {
    const repository = new FakeRepository(); const service = new F4Service(repository, () => new Date("2026-09-17T10:00:00+07:00"));
    const first = await service.createExpense(expense, owner); const replay = await service.createExpense(expense, owner); expect(replay).toEqual(first); expect(repository.expenses).toHaveLength(1);
    const raced = { ...expense, idempotencyKey: "22222222-2222-4222-8222-222222222222" }; repository.conflictOnce = true;
    expect(await service.createExpense(raced, owner)).toMatchObject({ ok: true, data: { amountRupiah: 50_000 } });
  });
  it("memisahkan daftar biaya dan pergerakan modal", async () => {
    const repository = new FakeRepository(); const service = new F4Service(repository, () => new Date("2026-09-17T10:00:00+07:00"));
    await service.createExpense(expense, owner);
    await service.createCapitalMovement({ type: "owner_draw", amountRupiah: 25_000, occurredAt, idempotencyKey: "33333333-3333-4333-8333-333333333333" }, owner);
    const expenses = await service.listExpenses({}, owner); const capital = await service.listCapitalMovements({}, owner);
    expect(expenses.ok && expenses.data).toHaveLength(1);
    expect(capital.ok && capital.data).toHaveLength(1);
  });
});
