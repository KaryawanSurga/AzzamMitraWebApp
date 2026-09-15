import { z } from "zod";

export const saleStatuses = ["draft", "confirmed", "completed", "cancelled"] as const;
export const paymentStatuses = ["unpaid", "partial", "paid", "due", "overdue", "refunded"] as const;
export const deliveryStatuses = ["unprocessed", "preparing", "ready", "in_transit", "partially_delivered", "received", "failed", "cancelled"] as const;
export const pricingBases = ["crate", "kg"] as const;

export const rupiahSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const positiveRupiahSchema = rupiahSchema.refine((value) => value > 0, "Nominal harus lebih dari nol.");
export const decimalQuantitySchema = z.string().regex(/^\d+(\.\d{1,3})?$/, "Kuantitas maksimal memiliki 3 angka desimal.").refine((value) => Number(value) > 0, "Kuantitas harus lebih dari nol.");

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
