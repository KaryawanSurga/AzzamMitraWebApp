import { z } from "zod";
import { crateMovementTypes, dateSchema, decimalQuantitySchema, idempotencyKeySchema, milliToQuantity, optionalText, quantityToMilli, uuidSchema } from "./contracts";

export type CrateMovementType = (typeof crateMovementTypes)[number];

export const crateReturnSchema = z.object({
  customerId: uuidSchema,
  crateQuantity: decimalQuantitySchema,
  occurredAt: dateSchema,
  notes: optionalText,
  idempotencyKey: idempotencyKeySchema,
});
export type CrateReturnInput = z.infer<typeof crateReturnSchema>;

export const crateMovementSchema = z.object({
  id: uuidSchema, movementNumber: z.string(), customerId: uuidSchema, saleId: uuidSchema.nullable(), deliveryId: uuidSchema.nullable(),
  type: z.enum(crateMovementTypes), crateQuantityMilli: z.number().int().nonnegative(), occurredAt: dateSchema, notes: z.string().nullable(),
});
export type CrateMovementRecord = z.infer<typeof crateMovementSchema>;

export const crateBalanceSchema = z.object({
  customerId: uuidSchema, customerNumber: z.string(), customerName: z.string(), balanceMilli: z.number().int(),
});
export type CrateBalance = z.infer<typeof crateBalanceSchema>;

export const crateHistoryInputSchema = z.object({
  customerId: uuidSchema, limit: z.number().int().min(1).max(100).default(20), offset: z.number().int().nonnegative().default(0),
});
export const crateBalanceListInputSchema = z.object({
  query: z.string().trim().max(200).default(""), limit: z.number().int().min(1).max(100).default(50), offset: z.number().int().nonnegative().default(0),
});
export const crateMovementListInputSchema = z.object({
  customerId: uuidSchema.optional(), limit: z.number().int().min(1).max(100).default(20), offset: z.number().int().nonnegative().default(0),
});

export const crateReturnListInputSchema = crateMovementListInputSchema;

/* saldo = peti keluar dikurangi peti kembali. Baris adjustment belum punya semantik tanda di MVP,
   jadi tidak dihitung sampai F6 mendefinisikannya. */
export function deriveCrateBalanceMilli(movements: Array<{ type: CrateMovementType; crateQuantityMilli: number }>): number {
  return movements.reduce((balance, movement) => {
    if (movement.type === "out") return balance + movement.crateQuantityMilli;
    if (movement.type === "return") return balance - movement.crateQuantityMilli;
    return balance;
  }, 0);
}

export function sumCrateMilli(items: Array<{ crateQuantity?: string | null }>): number {
  return items.reduce((total, item) => (item.crateQuantity ? total + quantityToMilli(item.crateQuantity) : total), 0);
}

export function validateCrateReturn(balanceMilli: number, incomingMilli: number): string | null {
  if (incomingMilli <= 0) return "Jumlah peti yang dikembalikan harus lebih dari nol.";
  if (incomingMilli > balanceMilli) return `Pengembalian melebihi saldo peti pelanggan (${milliToQuantity(balanceMilli)} peti).`;
  return null;
}
