import { z } from "zod";
import { dateSchema, idempotencyKeySchema, optionalText, paymentMethods, positiveRupiahSchema, uuidSchema } from "./contracts";
import { derivePaymentStatus } from "./sales";

export const paymentCreateSchema = z.object({
  saleId: uuidSchema,
  amountRupiah: positiveRupiahSchema,
  method: z.enum(paymentMethods, "Metode pembayaran tidak dikenal."),
  paidAt: dateSchema,
  notes: optionalText,
  idempotencyKey: idempotencyKeySchema,
});
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;

export const paymentRecordSchema = z.object({
  id: uuidSchema, paymentNumber: z.string(), saleId: uuidSchema, amountRupiah: positiveRupiahSchema,
  method: z.enum(paymentMethods), paidAt: dateSchema, notes: z.string().nullable(),
});
export type PaymentRecord = z.infer<typeof paymentRecordSchema>;

export const saleOperationsInputSchema = z.object({ saleId: uuidSchema });

/* Pembayaran yang sudah tercatat menentukan sisa piutang dan status, bukan sebaliknya. */
export function summarizePayments(payments: Array<{ amountRupiah: number }>, totalRupiah: number, dueDate: string | null, today: string) {
  const paidRupiah = payments.reduce((sum, payment) => sum + payment.amountRupiah, 0);
  const remainingRupiah = totalRupiah - paidRupiah;
  return { paidRupiah, remainingRupiah, paymentStatus: derivePaymentStatus(remainingRupiah, paidRupiah, dueDate, today) };
}

export function validatePaymentAmount(amountRupiah: number, remainingRupiah: number): string | null {
  if (remainingRupiah <= 0) return "Invoice ini sudah lunas.";
  if (amountRupiah > remainingRupiah) return "Nominal pembayaran melebihi sisa piutang.";
  return null;
}
