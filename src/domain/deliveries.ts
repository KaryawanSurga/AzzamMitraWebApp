import { z } from "zod";
import { dateSchema, decimalQuantitySchema, deliveryStatuses, idempotencyKeySchema, milliToQuantity, optionalText, uuidSchema } from "./contracts";

export type DeliveryStatus = (typeof deliveryStatuses)[number];

/* Status yang mengunci pengiriman. Sesudah ini hanya koreksi F6 yang boleh menyentuhnya. */
const terminalStatuses: readonly DeliveryStatus[] = ["failed", "cancelled"];
export const manualDeliveryStatuses = ["preparing", "ready", "in_transit", "failed", "cancelled"] as const;

export const deliveryCreateSchema = z.object({
  saleId: uuidSchema,
  crateQuantity: decimalQuantitySchema,
  dispatchedAt: dateSchema.optional(),
  notes: optionalText,
  idempotencyKey: idempotencyKeySchema,
});
export type DeliveryCreateInput = z.infer<typeof deliveryCreateSchema>;

export const deliveryReceiptSchema = z.object({
  deliveryId: uuidSchema,
  crateQuantity: decimalQuantitySchema,
  receivedAt: dateSchema,
  notes: optionalText,
  idempotencyKey: idempotencyKeySchema,
});
export type DeliveryReceiptInput = z.infer<typeof deliveryReceiptSchema>;

export const deliveryStatusUpdateSchema = z.object({
  deliveryId: uuidSchema,
  status: z.enum(manualDeliveryStatuses, "Status pengiriman tidak dikenal."),
  notes: optionalText,
  idempotencyKey: idempotencyKeySchema,
});
export type DeliveryStatusUpdateInput = z.infer<typeof deliveryStatusUpdateSchema>;

export const deliveryRecordSchema = z.object({
  id: uuidSchema, deliveryNumber: z.string(), saleId: uuidSchema, status: z.enum(deliveryStatuses),
  crateQuantityMilli: z.number().int().nonnegative(), receivedCrateQuantityMilli: z.number().int().nonnegative(),
  dispatchedAt: dateSchema.nullable(), receivedAt: dateSchema.nullable(), notes: z.string().nullable(),
});
export type DeliveryRecord = z.infer<typeof deliveryRecordSchema>;

export const deliveryListInputSchema = z.object({ saleId: uuidSchema });

/* Penerimaan bertahap menentukan status: sebagian, lalu diterima penuh. */
export function deriveDeliveryStatus(crateQuantityMilli: number, receivedCrateQuantityMilli: number, current: DeliveryStatus): DeliveryStatus {
  if (terminalStatuses.includes(current)) return current;
  if (receivedCrateQuantityMilli <= 0) return current;
  return receivedCrateQuantityMilli >= crateQuantityMilli ? "received" : "partially_delivered";
}

export function validateDeliveryPlan(saleCrateMilli: number, alreadyPlannedMilli: number, additionalMilli: number): string | null {
  if (saleCrateMilli <= 0) return "Penjualan ini tidak mencatat peti, jadi tidak ada yang bisa dikirim.";
  if (alreadyPlannedMilli + additionalMilli > saleCrateMilli) {
    return `Total rencana pengiriman melebihi jumlah peti pada penjualan (${milliToQuantity(saleCrateMilli)} peti).`;
  }
  return null;
}

export function validateDeliveryReceipt(crateQuantityMilli: number, receivedCrateQuantityMilli: number, incomingMilli: number, current: DeliveryStatus): string | null {
  if (terminalStatuses.includes(current)) return "Pengiriman ini sudah ditandai gagal atau dibatalkan.";
  if (incomingMilli <= 0) return "Jumlah yang diterima harus lebih dari nol.";
  if (receivedCrateQuantityMilli + incomingMilli > crateQuantityMilli) {
    return `Jumlah diterima melebihi rencana pengiriman (${milliToQuantity(crateQuantityMilli)} peti).`;
  }
  return null;
}

export function validateDeliveryStatusChange(current: DeliveryStatus, next: DeliveryStatus): string | null {
  if (terminalStatuses.includes(current)) return "Pengiriman yang gagal atau dibatalkan tidak dapat diubah lagi.";
  if (current === "received") return "Pengiriman yang sudah diterima tidak dapat diubah statusnya.";
  if (current === next) return "Status pengiriman sudah sama.";
  return null;
}
