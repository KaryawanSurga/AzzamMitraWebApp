import { z } from "zod";
import { idempotencyKeySchema, optionalText, paymentMethods, positiveRupiahSchema, uuidSchema } from "./contracts";

export const expenseCategories = ["egg_purchase", "delivery", "fuel_toll_parking", "loading", "wages", "packaging_crates", "maintenance", "rent_utilities_operations", "other"] as const;
export const capitalMovementTypes = ["capital_in", "owner_draw"] as const;
export type ExpenseCategory = (typeof expenseCategories)[number];
export type CapitalMovementType = (typeof capitalMovementTypes)[number];
export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  egg_purchase: "Pembelian telur",
  delivery: "Transportasi / pengiriman",
  fuel_toll_parking: "BBM, tol, dan parkir",
  loading: "Bongkar muat",
  wages: "Upah",
  packaging_crates: "Kemasan / peti",
  maintenance: "Perawatan",
  rent_utilities_operations: "Sewa, listrik, dan operasional",
  other: "Lainnya",
};

const occurredAtSchema = z.iso.datetime({ offset: true, error: "Waktu transaksi harus berupa tanggal dan waktu ISO 8601 dengan zona waktu." });

export const expenseCreateSchema = z.object({
  category: z.enum(expenseCategories, "Kategori pengeluaran tidak dikenal."),
  amountRupiah: positiveRupiahSchema,
  method: z.enum(paymentMethods, "Metode pembayaran tidak dikenal.").optional(),
  occurredAt: occurredAtSchema,
  notes: optionalText,
  idempotencyKey: idempotencyKeySchema,
});
export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;

export const capitalMovementCreateSchema = z.object({
  type: z.enum(capitalMovementTypes, "Jenis pergerakan modal tidak dikenal."),
  amountRupiah: positiveRupiahSchema,
  occurredAt: occurredAtSchema,
  notes: optionalText,
  idempotencyKey: idempotencyKeySchema,
});
export type CapitalMovementCreateInput = z.infer<typeof capitalMovementCreateSchema>;

const listInput = z.object({
  from: occurredAtSchema.optional(),
  to: occurredAtSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
}).refine(
  ({ from, to }) => !from || !to || new Date(from).getTime() <= new Date(to).getTime(),
  { path: ["to"], message: "Batas akhir periode tidak boleh sebelum batas awal." },
);

export const expenseListSchema = listInput;
export const capitalMovementListSchema = listInput;

export type FinanceListInput = z.infer<typeof listInput>;
export type ExpenseRecord = { id: string; expenseNumber: string; category: (typeof expenseCategories)[number]; amountRupiah: number; method: (typeof paymentMethods)[number] | null; occurredAt: string; notes: string | null };
export type CapitalMovementRecord = { id: string; movementNumber: string; type: (typeof capitalMovementTypes)[number]; amountRupiah: number; occurredAt: string; notes: string | null };
export function jakartaDateTimeLocal(value = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}`;
}

export function validateFinanceOccurredAt(value: string, now = new Date()): string | null {
  const occurredAt = new Date(value);
  if (occurredAt.getTime() > now.getTime()) return "Waktu transaksi tidak boleh di masa depan (zona Asia/Jakarta).";
  const jakarta = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const part = Object.fromEntries(jakarta.map(({ type, value: partValue }) => [type, partValue]));
  const lastYear = Number(part.year) - 1;
  const lastDay = new Date(Date.UTC(lastYear, Number(part.month), 0)).getUTCDate();
  const cutoff = new Date(`${lastYear}-${part.month}-${String(Math.min(Number(part.day), lastDay)).padStart(2, "0")}T${part.hour}:${part.minute}:${part.second}+07:00`);
  return occurredAt.getTime() < cutoff.getTime() ? "Waktu transaksi maksimal satu tahun ke belakang (zona Asia/Jakarta)." : null;
}

export const financeIdSchema = z.object({ id: uuidSchema });
