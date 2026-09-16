import { describe, expect, it } from "vitest";
import { capitalMovementCreateSchema, expenseCreateSchema, validateFinanceOccurredAt } from "./finance";

const base = { category: "egg_purchase", amountRupiah: 100_000, occurredAt: "2026-09-17T08:00:00+07:00", idempotencyKey: "11111111-1111-4111-8111-111111111111" } as const;

describe("finance contracts", () => {
  it("menerima pengeluaran tanpa metode dan menormalisasi catatan", () => {
    const parsed = expenseCreateSchema.parse({ ...base, notes: "  telur kandang  " });
    expect(parsed.notes).toBe("telur kandang");
    expect(parsed.method).toBeUndefined();
  });
  it.each([
    [{ ...base, amountRupiah: 0 }, "amountRupiah"],
    [{ ...base, amountRupiah: -1 }, "amountRupiah"],
    [{ ...base, category: "inventory" }, "category"],
    [{ ...base, method: "card" }, "method"],
    [{ ...base, occurredAt: "2026-09-17" }, "occurredAt"],
  ])("menolak input pengeluaran invalid", (input, field) => expect(expenseCreateSchema.safeParse(input).error?.flatten().fieldErrors).toHaveProperty(field));
  it("hanya menerima modal masuk dan prive", () => {
    expect(capitalMovementCreateSchema.safeParse({ type: "capital_in", amountRupiah: 1, occurredAt: base.occurredAt, idempotencyKey: base.idempotencyKey }).success).toBe(true);
    expect(capitalMovementCreateSchema.safeParse({ type: "income", amountRupiah: 1, occurredAt: base.occurredAt, idempotencyKey: base.idempotencyKey }).success).toBe(false);
  });
  it("menerapkan batas waktu Jakarta termasuk tepat satu tahun", () => {
    const now = new Date("2026-09-17T10:00:00+07:00");
    expect(validateFinanceOccurredAt("2026-09-17T10:00:01+07:00", now)).toContain("masa depan");
    expect(validateFinanceOccurredAt("2025-09-17T09:59:59+07:00", now)).toContain("satu tahun");
    expect(validateFinanceOccurredAt("2025-09-17T10:00:00+07:00", now)).toBeNull();
  });
});
