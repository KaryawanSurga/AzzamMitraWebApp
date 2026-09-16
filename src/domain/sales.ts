import { z } from "zod";
import { dateSchema, decimalQuantitySchema, idempotencyKeySchema, optionalText, rupiahSchema, scaledQuantity, uuidSchema } from "./contracts";


export const customerCreateSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  name: z.string().trim().min(1, "Nama pelanggan wajib diisi.").max(200, "Nama pelanggan maksimal 200 karakter."),
  whatsapp: z.string().trim().max(30, "Nomor WhatsApp maksimal 30 karakter.").optional(),
  address: optionalText,
  notes: optionalText,
});
export const customerUpdateSchema = customerCreateSchema.omit({ idempotencyKey: true }).partial().extend({ id: uuidSchema, idempotencyKey: idempotencyKeySchema }).refine(
  (value) => (["name", "whatsapp", "address", "notes"] as const).some((key) => value[key] !== undefined),
  "Minimal satu data pelanggan harus diubah.",
);
export const customerListSchema = z.object({ query: z.string().trim().max(200).default(""), includeArchived: z.boolean().default(false), limit: z.number().int().min(1).max(100).default(20), offset: z.number().int().nonnegative().default(0) });
export const customerIdSchema = z.object({ id: uuidSchema });
export const customerArchiveSchema = customerIdSchema.extend({ idempotencyKey: idempotencyKeySchema });
export const customerRecordSchema = z.object({
  id: uuidSchema, customerNumber: z.string(), name: z.string(), whatsapp: z.string().nullable(),
  address: z.string().nullable(), notes: z.string().nullable(), isActive: z.boolean(),
});

const saleItemInputSchema = z.object({
  description: z.string().trim().min(1, "Deskripsi item wajib diisi.").max(200),
  pricingBasis: z.enum(["crate", "kg"], "Dasar harga harus per peti atau per kg."),
  crateQuantity: decimalQuantitySchema.optional(), weightKg: decimalQuantitySchema.optional(),
  unitPriceRupiah: rupiahSchema,
}).superRefine((item, ctx) => {
  if (item.pricingBasis === "crate" && !item.crateQuantity) ctx.addIssue({ code: "custom", path: ["crateQuantity"], message: "Jumlah peti wajib diisi untuk harga per peti." });
  if (item.pricingBasis === "kg" && !item.weightKg) ctx.addIssue({ code: "custom", path: ["weightKg"], message: "Berat aktual wajib diisi untuk harga per kg." });
});

export const saleMutationSchema = z.object({
  customerId: uuidSchema, transactionDate: dateSchema, items: z.array(saleItemInputSchema).min(1, "Minimal satu item penjualan wajib diisi."),
  discountRupiah: rupiahSchema.default(0), feeRupiah: rupiahSchema.default(0), notes: optionalText,
  paymentChoice: z.enum(["full", "down_payment", "debt"]), initialPaymentRupiah: rupiahSchema.default(0),
  paymentMethod: z.enum(["cash", "transfer", "other"]).optional(), dueDate: dateSchema.optional(),
  idempotencyKey: idempotencyKeySchema, status: z.enum(["draft", "confirmed"]).default("confirmed"),
}).superRefine((sale, ctx) => {
  if (sale.paymentChoice === "debt" && sale.initialPaymentRupiah !== 0) ctx.addIssue({ code: "custom", path: ["initialPaymentRupiah"], message: "Penjualan utang tidak boleh memiliki pembayaran awal." });
  if (sale.paymentChoice === "down_payment" && sale.initialPaymentRupiah <= 0) ctx.addIssue({ code: "custom", path: ["initialPaymentRupiah"], message: "Nominal DP harus lebih dari nol." });
  if (sale.paymentChoice !== "debt" && !sale.paymentMethod) ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Metode pembayaran wajib untuk pembayaran penuh atau DP." });
  if (sale.status === "draft" && sale.paymentChoice !== "debt") ctx.addIssue({ code: "custom", path: ["status"], message: "Draft belum boleh mencatat pembayaran awal." });
  if (sale.status === "confirmed" && sale.paymentChoice !== "full" && !sale.dueDate) ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Tanggal jatuh tempo wajib untuk DP atau utang." });
  if (sale.dueDate && sale.dueDate < sale.transactionDate) ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Tanggal jatuh tempo tidak boleh sebelum tanggal transaksi." });
});
export type SaleMutationInput = z.infer<typeof saleMutationSchema>;
export const saleRecordSchema = z.object({
  id: uuidSchema, invoiceNumber: z.string(), idempotencyKey: idempotencyKeySchema, totalRupiah: rupiahSchema,
  paidRupiah: rupiahSchema, remainingRupiah: rupiahSchema,
  dueDate: dateSchema.nullable(), paymentStatus: z.enum(["unpaid", "partial", "paid", "due", "overdue"]), status: z.enum(["draft", "confirmed"]),
});
export type CustomerRecord = z.infer<typeof customerRecordSchema>;
export type SaleRecord = z.infer<typeof saleRecordSchema>;
export const saleListSchema = z.object({ query: z.string().trim().max(200).default(""), limit: z.number().int().min(1).max(100).default(50), offset: z.number().int().nonnegative().default(0) });
export const saleIdSchema = z.object({ id: uuidSchema });
export type SaleListItem = SaleRecord & { customerName: string; transactionDate: string };
export type SaleDetail = SaleListItem & { customerId: string; customerNumber: string; subtotalRupiah: number; discountRupiah: number; feeRupiah: number; notes: string | null; items: Array<{ id: string; description: string; pricingBasis: "crate" | "kg"; crateQuantity: string | null; weightKg: string | null; unitPriceRupiah: number; subtotalRupiah: number }>; payments: Array<{ id: string; amountRupiah: number; method: "cash" | "transfer" | "other"; paidAt: string }> };

export function derivePaymentStatus(remainingRupiah: number, paidRupiah: number, dueDate: string | null | undefined, today: string) {
  if (remainingRupiah === 0) return "paid" as const;
  if (dueDate && dueDate < today) return "overdue" as const;
  if (dueDate === today) return "due" as const;
  return paidRupiah > 0 ? "partial" as const : "unpaid" as const;
}

export function calculateSale(input: SaleMutationInput, today?: string) {
  const items = input.items.map((item) => {
    const quantity = item.pricingBasis === "crate" ? item.crateQuantity! : item.weightKg!;
    const numerator = scaledQuantity(quantity) * BigInt(item.unitPriceRupiah);
    if (numerator % BigInt(1000) !== BigInt(0)) throw new Error("Subtotal item harus menghasilkan rupiah bulat.");
    const subtotalRupiah = Number(numerator / BigInt(1000));
    if (!Number.isSafeInteger(subtotalRupiah)) throw new Error("Subtotal item melebihi batas nominal yang didukung.");
    return { ...item, pricingQuantity: quantity, unitSnapshot: item.pricingBasis === "crate" ? "peti" : "kg", subtotalRupiah };
  });
  const subtotalRupiah = items.reduce((sum, item) => sum + item.subtotalRupiah, 0);
  const totalRupiah = subtotalRupiah - input.discountRupiah + input.feeRupiah;
  if (!Number.isSafeInteger(subtotalRupiah) || !Number.isSafeInteger(totalRupiah)) throw new Error("Total penjualan melebihi batas nominal yang didukung.");
  if (totalRupiah < 0) throw new Error("Diskon tidak boleh membuat total penjualan negatif.");
  const paidRupiah = input.paymentChoice === "full" ? totalRupiah : input.paymentChoice === "debt" ? 0 : input.initialPaymentRupiah;
  if (paidRupiah > totalRupiah) throw new Error("Pembayaran awal tidak boleh melebihi total penjualan.");
  const remainingRupiah = totalRupiah - paidRupiah;
  const paymentStatus = derivePaymentStatus(remainingRupiah, paidRupiah, input.dueDate, today ?? "0000-00-00");
  return { items, subtotalRupiah, totalRupiah, paidRupiah, remainingRupiah, paymentStatus } as const;
}

export function jakartaDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
}
export function validateTransactionDate(value: string, now = new Date()): string | null {
  const today = jakartaDate(now);
  const [year, month, day] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year - 1, month, 0)).getUTCDate();
  const minimum = `${year - 1}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
  if (value > today) return "Tanggal transaksi tidak boleh di masa depan (zona Asia/Jakarta).";
  if (value < minimum) return "Tanggal transaksi maksimal satu tahun ke belakang (zona Asia/Jakarta).";
  return null;
}
