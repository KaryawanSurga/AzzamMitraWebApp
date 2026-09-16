import { z } from "zod";

export const saleStatuses = ["draft", "confirmed", "completed", "cancelled"] as const;
export const paymentStatuses = ["unpaid", "partial", "paid", "due", "overdue", "refunded"] as const;
export const deliveryStatuses = ["unprocessed", "preparing", "ready", "in_transit", "partially_delivered", "received", "failed", "cancelled"] as const;
export const pricingBases = ["crate", "kg"] as const;
export const paymentMethods = ["cash", "transfer", "other"] as const;
export const crateMovementTypes = ["out", "return", "adjustment"] as const;

export const rupiahSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const positiveRupiahSchema = rupiahSchema.refine((value) => value > 0, "Nominal harus lebih dari nol.");
export const decimalQuantitySchema = z.string().regex(/^\d+(\.\d{1,3})?$/, "Kuantitas maksimal memiliki 3 angka desimal.").refine((value) => Number(value) > 0, "Kuantitas harus lebih dari nol.");

export const uuidSchema = z.string().uuid("ID harus berupa UUID yang valid.");
export const idempotencyKeySchema = z.string().uuid("Kunci idempotensi harus berupa UUID yang valid.");
export const optionalText = z.string().trim().max(2_000, "Teks maksimal 2.000 karakter.").optional();

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus berformat YYYY-MM-DD.").refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "Tanggal kalender tidak valid.");

export const saleItemSnapshotSchema = z.object({
  pricingBasis: z.enum(pricingBases),
  crateQuantity: decimalQuantitySchema.optional(),
  weightKg: decimalQuantitySchema.optional(),
  pricingQuantity: decimalQuantitySchema,
  unitPriceRupiah: rupiahSchema,
  subtotalRupiah: rupiahSchema,
}).superRefine((item, context) => {
  if (item.pricingBasis === "crate" && !item.crateQuantity) context.addIssue({ code: "custom", path: ["crateQuantity"], message: "Jumlah peti wajib diisi untuk harga per peti." });
  if (item.pricingBasis === "kg" && !item.weightKg) context.addIssue({ code: "custom", path: ["weightKg"], message: "Berat wajib diisi untuk harga per kg." });
});

export type SaleItemSnapshot = z.infer<typeof saleItemSnapshotSchema>;

/* Kuantitas disimpan sebagai bilangan bulat mili (3 angka desimal) agar tidak memakai floating point. */
export function scaledQuantity(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > 3) throw new Error("Kuantitas maksimal memiliki 3 angka desimal.");
  return BigInt(whole) * BigInt(1000) + BigInt(fraction.padEnd(3, "0"));
}

export function quantityToMilli(value: string): number {
  const milli = scaledQuantity(value);
  if (milli > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Kuantitas melebihi batas yang didukung.");
  return Number(milli);
}

export function milliToQuantity(milli: number): string {
  const fraction = String(Math.abs(milli % 1000)).padStart(3, "0").replace(/0+$/, "");
  return fraction ? `${Math.trunc(milli / 1000)}.${fraction}` : String(Math.trunc(milli / 1000));
}
