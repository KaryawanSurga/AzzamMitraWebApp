import { describe, expect, it } from "vitest";
import { paymentCreateSchema, summarizePayments, validatePaymentAmount } from "./payments";

const validPayment = { saleId: "11111111-1111-4111-8111-111111111111", amountRupiah: 500_000, method: "transfer", paidAt: "2026-09-16", idempotencyKey: "22222222-2222-4222-8222-222222222222" } as const;

describe("kontrak pembayaran", () => {
  it("menerima pembayaran lengkap dan menolak nominal atau metode yang tidak sah", () => {
    expect(paymentCreateSchema.safeParse(validPayment).success).toBe(true);
    expect(paymentCreateSchema.safeParse({ ...validPayment, amountRupiah: 0 }).success).toBe(false);
    expect(paymentCreateSchema.safeParse({ ...validPayment, method: "giro" }).success).toBe(false);
    expect(paymentCreateSchema.safeParse({ ...validPayment, idempotencyKey: "x" }).success).toBe(false);
  });

  it("menolak nominal melebihi sisa piutang dan invoice yang sudah lunas", () => {
    expect(validatePaymentAmount(500_000, 500_000)).toBeNull();
    expect(validatePaymentAmount(600_000, 500_000)).toBe("Nominal pembayaran melebihi sisa piutang.");
    expect(validatePaymentAmount(1, 0)).toBe("Invoice ini sudah lunas.");
  });

  it("menurunkan status dari agregat pembayaran, jatuh tempo, dan tanggal server", () => {
    const total = 2_000_000;
    expect(summarizePayments([{ amountRupiah: 500_000 }], total, "2026-09-20", "2026-09-16")).toMatchObject({ paidRupiah: 500_000, remainingRupiah: 1_500_000, paymentStatus: "partial" });
    expect(summarizePayments([{ amountRupiah: 1_000_000 }, { amountRupiah: 1_000_000 }], total, "2026-09-20", "2026-09-16")).toMatchObject({ remainingRupiah: 0, paymentStatus: "paid" });
    expect(summarizePayments([{ amountRupiah: 500_000 }], total, "2026-09-15", "2026-09-16")).toMatchObject({ paymentStatus: "overdue" });
    expect(summarizePayments([{ amountRupiah: 500_000 }], total, "2026-09-16", "2026-09-16")).toMatchObject({ paymentStatus: "due" });
    expect(summarizePayments([], total, "2026-09-20", "2026-09-16")).toMatchObject({ paidRupiah: 0, remainingRupiah: total, paymentStatus: "unpaid" });
  });
});
