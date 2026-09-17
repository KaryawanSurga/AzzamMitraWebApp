import { describe, expect, it } from "vitest";
import { buildSaleCorrection, isCancellableStatus, saleCancellationSchema, saleCorrectionSchema, type SaleCorrectionCurrent } from "./adjustments";

const current: SaleCorrectionCurrent = {
  subtotalRupiah: 1_500_000,
  discountRupiah: 0,
  feeRupiah: 0,
  totalRupiah: 1_500_000,
  paidRupiah: 1_000_000,
  transactionDate: "2026-09-10",
  dueDate: "2026-10-10",
  notes: "Antar pagi",
};

const key = "22222222-2222-4222-8222-222222222222";
const saleId = "11111111-1111-4111-8111-111111111111";

describe("sale correction domain", () => {
  it("mewajibkan alasan yang jelas untuk pembatalan", () => {
    expect(saleCancellationSchema.safeParse({ saleId, reason: "salah", idempotencyKey: key }).success).toBe(false);
    expect(saleCancellationSchema.safeParse({ saleId, reason: "Salah input pelanggan", idempotencyKey: key }).success).toBe(true);
  });

  it("menerima koreksi parsial dan menghitung total baru", () => {
    const plan = buildSaleCorrection(current, { saleId, reason: "Diskon disepakati ulang", discountRupiah: 200_000, idempotencyKey: key });
    expect(plan).toMatchObject({ ok: true, next: { totalRupiah: 1_300_000, discountRupiah: 200_000 }, changes: ["diskon"] });
  });

  it("menolak koreksi yang membuat total di bawah pembayaran diterima", () => {
    const plan = buildSaleCorrection(current, { saleId, reason: "Potong besar", discountRupiah: 600_000, idempotencyKey: key });
    expect(plan).toMatchObject({ ok: false, field: "discountRupiah" });
  });

  it("menolak jatuh tempo sebelum tanggal transaksi dan koreksi kosong", () => {
    expect(buildSaleCorrection(current, { saleId, reason: "Mundur salah", dueDate: "2026-09-01", idempotencyKey: key })).toMatchObject({ ok: false, field: "dueDate" });
    expect(buildSaleCorrection(current, { saleId, reason: "Tanpa perubahan", idempotencyKey: key })).toMatchObject({ ok: false });
  });

  it("mengizinkan penghapusan jatuh tempo dan catatan lewat null", () => {
    const plan = buildSaleCorrection(current, { saleId, reason: "Lunas jadi tanpa tempo", dueDate: null, notes: null, idempotencyKey: key });
    expect(plan).toMatchObject({ ok: true, next: { dueDate: null, notes: null }, changes: ["jatuh tempo", "catatan"] });
  });

  it("hanya mengizinkan pembatalan untuk invoice terkonfirmasi atau selesai", () => {
    expect(isCancellableStatus("confirmed")).toBe(true);
    expect(isCancellableStatus("completed")).toBe(true);
    expect(isCancellableStatus("draft")).toBe(false);
    expect(isCancellableStatus("cancelled")).toBe(false);
  });

  it("menolak schema koreksi tanpa field perubahan", () => {
    expect(saleCorrectionSchema.safeParse({ saleId, reason: "Catatan koreksi", idempotencyKey: key }).success).toBe(false);
  });
});
