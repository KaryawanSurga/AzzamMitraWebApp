import { z } from "zod";
import { dateSchema, idempotencyKeySchema, rupiahSchema, uuidSchema } from "./contracts";

export const adjustmentTypes = ["discount", "return", "refund", "correction", "cancellation"] as const;
export type AdjustmentType = (typeof adjustmentTypes)[number];

export const adjustmentTypeLabels: Record<AdjustmentType, string> = {
  discount: "Potongan",
  return: "Retur",
  refund: "Refund",
  correction: "Koreksi",
  cancellation: "Pembatalan",
};

const reasonSchema = z.string().trim().min(10, "Alasan minimal 10 karakter.").max(500, "Alasan maksimal 500 karakter.");

export const saleCancellationSchema = z.object({
  saleId: uuidSchema,
  reason: reasonSchema,
  idempotencyKey: idempotencyKeySchema,
});

export const saleCorrectionSchema = z.object({
  saleId: uuidSchema,
  reason: reasonSchema,
  discountRupiah: rupiahSchema.optional(),
  feeRupiah: rupiahSchema.optional(),
  dueDate: dateSchema.nullable().optional(),
  notes: z.string().trim().max(2_000, "Catatan maksimal 2.000 karakter.").nullable().optional(),
  idempotencyKey: idempotencyKeySchema,
}).refine(
  (value) => value.discountRupiah !== undefined || value.feeRupiah !== undefined || value.dueDate !== undefined || value.notes !== undefined,
  "Minimal satu data invoice harus dikoreksi.",
);

export type SaleCancellationInput = z.infer<typeof saleCancellationSchema>;
export type SaleCorrectionInput = z.infer<typeof saleCorrectionSchema>;

export type SaleCorrectionCurrent = {
  subtotalRupiah: number;
  discountRupiah: number;
  feeRupiah: number;
  totalRupiah: number;
  paidRupiah: number;
  transactionDate: string;
  dueDate: string | null;
  notes: string | null;
};

export type SaleCorrectionNext = {
  discountRupiah: number;
  feeRupiah: number;
  totalRupiah: number;
  dueDate: string | null;
  notes: string | null;
};

export type SaleCorrectionPlan = { ok: true; next: SaleCorrectionNext; changes: string[] } | { ok: false; message: string; field?: string };

const correctedNotes = (current: string | null, input: string | null | undefined) => input === undefined ? current : input && input.length > 0 ? input : null;

export function buildSaleCorrection(current: SaleCorrectionCurrent, input: SaleCorrectionInput): SaleCorrectionPlan {
  const discountRupiah = input.discountRupiah ?? current.discountRupiah;
  const feeRupiah = input.feeRupiah ?? current.feeRupiah;
  const dueDate = input.dueDate === undefined ? current.dueDate : input.dueDate;
  const notes = correctedNotes(current.notes, input.notes);
  const totalRupiah = current.subtotalRupiah - discountRupiah + feeRupiah;

  if (totalRupiah < 0) return { ok: false, message: "Diskon tidak boleh melebihi subtotal invoice.", field: "discountRupiah" };
  if (totalRupiah < current.paidRupiah) return { ok: false, message: "Total koreksi tidak boleh lebih kecil dari pembayaran yang sudah diterima.", field: "discountRupiah" };
  if (dueDate && dueDate < current.transactionDate) return { ok: false, message: "Jatuh tempo tidak boleh sebelum tanggal transaksi.", field: "dueDate" };

  const changes: string[] = [];
  if (discountRupiah !== current.discountRupiah) changes.push("diskon");
  if (feeRupiah !== current.feeRupiah) changes.push("biaya");
  if (dueDate !== current.dueDate) changes.push("jatuh tempo");
  if (notes !== current.notes) changes.push("catatan");
  if (changes.length === 0) return { ok: false, message: "Tidak ada perubahan yang dikoreksi." };

  return { ok: true, next: { discountRupiah, feeRupiah, totalRupiah, dueDate, notes }, changes };
}

export function isCancellableStatus(status: string): boolean {
  return status === "confirmed" || status === "completed";
}
