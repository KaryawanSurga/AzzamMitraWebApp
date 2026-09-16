import "server-only";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { milliToQuantity, quantityToMilli } from "@/domain/contracts";
import { sumCrateMilli } from "@/domain/crates";
import type { CrateMovementRecord, CrateReturnInput } from "@/domain/crates";
import type { DeliveryCreateInput, DeliveryRecord, DeliveryStatus } from "@/domain/deliveries";
import { summarizePayments } from "@/domain/payments";
import type { PaymentCreateInput, PaymentRecord } from "@/domain/payments";
import { jakartaDate } from "@/domain/sales";
import type { OwnerProfile } from "@/lib/auth/owner";
import { toRepositoryError } from "@/server/errors";
import type { CrateBalance, DeliveryMutation, F3Repository, SaleBilling } from "./repository";

type Db = NodePgDatabase<typeof schema>;
type DeliveryRow = { id: string; deliveryNumber: string; saleId: string; status: string; crateQuantity: string; receivedCrateQuantity: string; dispatchedAt: Date | null; receivedAt: Date | null; notes: string | null };

const displayNumber = (prefix: string) => `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
const jakartaMidnight = (date: string) => new Date(`${date}T00:00:00+07:00`);
const dbError: (error: unknown) => never = toRepositoryError;

const paymentColumns = { id: schema.payments.id, paymentNumber: schema.payments.paymentNumber, saleId: schema.payments.saleId, amountRupiah: schema.payments.amountRupiah, method: schema.payments.method, paidAt: schema.payments.paidAt, notes: schema.payments.notes };
const deliveryColumns = { id: schema.deliveries.id, deliveryNumber: schema.deliveries.deliveryNumber, saleId: schema.deliveries.saleId, status: schema.deliveries.status, crateQuantity: schema.deliveries.crateQuantity, receivedCrateQuantity: schema.deliveries.receivedCrateQuantity, dispatchedAt: schema.deliveries.dispatchedAt, receivedAt: schema.deliveries.receivedAt, notes: schema.deliveries.notes };
const movementColumns = { id: schema.crateMovements.id, movementNumber: schema.crateMovements.movementNumber, customerId: schema.crateMovements.customerId, saleId: schema.crateMovements.saleId, deliveryId: schema.crateMovements.deliveryId, type: schema.crateMovements.type, quantity: schema.crateMovements.quantity, occurredAt: schema.crateMovements.occurredAt, reason: schema.crateMovements.reason };

/* Saldo peti: peti keluar dikurangi peti kembali. Baris adjustment belum dihitung sampai semantiknya ditetapkan di F6. */
const crateBalance = sql<string>`coalesce(sum(case when ${schema.crateMovements.type} = 'return' then -${schema.crateMovements.quantity} else ${schema.crateMovements.quantity} end) filter (where ${schema.crateMovements.type} <> 'adjustment'), 0)`;

function toPayment(row: { id: string; paymentNumber: string; saleId: string; amountRupiah: number; method: string; paidAt: Date; notes: string | null }): PaymentRecord {
  return { id: row.id, paymentNumber: row.paymentNumber, saleId: row.saleId, amountRupiah: row.amountRupiah, method: row.method as PaymentRecord["method"], paidAt: jakartaDate(row.paidAt), notes: row.notes };
}

function toDelivery(row: DeliveryRow): DeliveryRecord {
  return { id: row.id, deliveryNumber: row.deliveryNumber, saleId: row.saleId, status: row.status as DeliveryStatus, crateQuantityMilli: quantityToMilli(row.crateQuantity), receivedCrateQuantityMilli: quantityToMilli(row.receivedCrateQuantity), dispatchedAt: row.dispatchedAt ? jakartaDate(row.dispatchedAt) : null, receivedAt: row.receivedAt ? jakartaDate(row.receivedAt) : null, notes: row.notes };
}

function toMovement(row: { id: string; movementNumber: string; customerId: string; saleId: string | null; deliveryId: string | null; type: string; quantity: string; occurredAt: Date; reason: string | null }): CrateMovementRecord {
  return { id: row.id, movementNumber: row.movementNumber, customerId: row.customerId, saleId: row.saleId, deliveryId: row.deliveryId, type: row.type as CrateMovementRecord["type"], crateQuantityMilli: quantityToMilli(row.quantity), occurredAt: jakartaDate(row.occurredAt), notes: row.reason };
}

export class DrizzleF3Repository implements F3Repository {
  constructor(private readonly db: Db) {}

  async getSaleBilling(saleId: string): Promise<SaleBilling | null> {
    try {
      const [sale] = await this.db.select({ id: schema.sales.id, invoiceNumber: schema.sales.invoiceNumber, customerId: schema.sales.customerId, customerName: schema.customers.name, status: schema.sales.status, totalRupiah: schema.sales.totalRupiah, dueDate: schema.sales.dueDate }).from(schema.sales).innerJoin(schema.customers, eq(schema.sales.customerId, schema.customers.id)).where(eq(schema.sales.id, saleId)).limit(1);
      if (!sale) return null;
      const [payments, items] = await Promise.all([
        this.db.select({ amountRupiah: schema.payments.amountRupiah }).from(schema.payments).where(eq(schema.payments.saleId, saleId)),
        this.db.select({ crateQuantity: schema.saleItems.crateQuantity }).from(schema.saleItems).where(eq(schema.saleItems.saleId, saleId)),
      ]);
      return { id: sale.id, invoiceNumber: sale.invoiceNumber, customerId: sale.customerId, customerName: sale.customerName, status: sale.status as SaleBilling["status"], totalRupiah: sale.totalRupiah, paidRupiah: payments.reduce((sum, payment) => sum + payment.amountRupiah, 0), dueDate: sale.dueDate, crateQuantityMilli: sumCrateMilli(items) };
    } catch (error) {
      dbError(error);
    }
  }

  async findPaymentByIdempotencyKey(key: string): Promise<PaymentRecord | null> {
    try {
      const [row] = await this.db.select(paymentColumns).from(schema.payments).where(eq(schema.payments.idempotencyKey, key)).limit(1);
      return row ? toPayment(row) : null;
    } catch (error) {
      dbError(error);
    }
  }

  async listPayments(saleId: string): Promise<PaymentRecord[]> {
    try {
      const rows = await this.db.select(paymentColumns).from(schema.payments).where(eq(schema.payments.saleId, saleId)).orderBy(schema.payments.paidAt, schema.payments.createdAt);
      return rows.map(toPayment);
    } catch (error) {
      dbError(error);
    }
  }

  async createPaymentAtomic(input: PaymentCreateInput, billing: SaleBilling, today: string, actor: OwnerProfile): Promise<PaymentRecord> {
    try {
      return await this.db.transaction(async (tx) => {
        const paymentNumber = displayNumber("PAY");
        const [row] = await tx.insert(schema.payments).values({ paymentNumber, saleId: input.saleId, amountRupiah: input.amountRupiah, method: input.method, paidAt: jakartaMidnight(input.paidAt), notes: input.notes, idempotencyKey: input.idempotencyKey }).returning(paymentColumns);
        const payments = await tx.select({ amountRupiah: schema.payments.amountRupiah }).from(schema.payments).where(eq(schema.payments.saleId, input.saleId));
        const summary = summarizePayments(payments, billing.totalRupiah, billing.dueDate, today);
        await tx.update(schema.sales).set({ paymentStatus: summary.paymentStatus, updatedAt: new Date() }).where(eq(schema.sales.id, input.saleId));
        await tx.insert(schema.auditEvents).values({ eventNumber: displayNumber("AUD"), idempotencyKey: input.idempotencyKey, actorId: actor.id, entityType: "sale", entityId: input.saleId, action: "sale.payment_recorded", before: { paidRupiah: billing.paidRupiah }, after: { paidRupiah: summary.paidRupiah, remainingRupiah: summary.remainingRupiah, paymentStatus: summary.paymentStatus, paymentNumber } });
        return toPayment(row);
      });
    } catch (error) {
      dbError(error);
    }
  }

  async findDeliveryByIdempotencyKey(key: string): Promise<DeliveryRecord | null> {
    try {
      const [row] = await this.db.select(deliveryColumns).from(schema.deliveries).where(eq(schema.deliveries.idempotencyKey, key)).limit(1);
      if (row) return toDelivery(row);
      const [event] = await this.db.select({ entityId: schema.auditEvents.entityId }).from(schema.auditEvents).where(and(eq(schema.auditEvents.idempotencyKey, key), eq(schema.auditEvents.entityType, "delivery"))).limit(1);
      return event ? this.getDelivery(event.entityId) : null;
    } catch (error) {
      dbError(error);
    }
  }

  async getDelivery(id: string): Promise<DeliveryRecord | null> {
    try {
      const [row] = await this.db.select(deliveryColumns).from(schema.deliveries).where(eq(schema.deliveries.id, id)).limit(1);
      return row ? toDelivery(row) : null;
    } catch (error) {
      dbError(error);
    }
  }

  async listDeliveries(saleId: string): Promise<DeliveryRecord[]> {
    try {
      const rows = await this.db.select(deliveryColumns).from(schema.deliveries).where(eq(schema.deliveries.saleId, saleId)).orderBy(schema.deliveries.createdAt);
      return rows.map(toDelivery);
    } catch (error) {
      dbError(error);
    }
  }

  async plannedCrateQuantityMilli(saleId: string): Promise<number> {
    try {
      const [row] = await this.db.select({ planned: sql<string>`coalesce(sum(${schema.deliveries.crateQuantity}), 0)` }).from(schema.deliveries).where(eq(schema.deliveries.saleId, saleId));
      return quantityToMilli(row.planned);
    } catch (error) {
      dbError(error);
    }
  }

  async createDeliveryAtomic(input: DeliveryCreateInput, actor: OwnerProfile): Promise<DeliveryRecord> {
    try {
      return await this.db.transaction(async (tx) => {
        const deliveryNumber = displayNumber("DLV");
        const [row] = await tx.insert(schema.deliveries).values({ deliveryNumber, saleId: input.saleId, status: input.dispatchedAt ? "in_transit" : "unprocessed", crateQuantity: milliToQuantity(quantityToMilli(input.crateQuantity)), receivedCrateQuantity: "0", dispatchedAt: input.dispatchedAt ? jakartaMidnight(input.dispatchedAt) : null, notes: input.notes, idempotencyKey: input.idempotencyKey }).returning(deliveryColumns);
        await tx.insert(schema.auditEvents).values({ eventNumber: displayNumber("AUD"), idempotencyKey: input.idempotencyKey, actorId: actor.id, entityType: "delivery", entityId: row.id, action: "delivery.created", after: { deliveryNumber, status: row.status, crateQuantity: row.crateQuantity } });
        return toDelivery(row);
      });
    } catch (error) {
      dbError(error);
    }
  }

  async updateDeliveryAtomic(mutation: DeliveryMutation, actor: OwnerProfile): Promise<DeliveryRecord> {
    try {
      return await this.db.transaction(async (tx) => {
        const receivedAt = mutation.receivedAt ?? mutation.delivery.receivedAt;
        const [row] = await tx.update(schema.deliveries).set({ status: mutation.status, receivedCrateQuantity: milliToQuantity(mutation.receivedCrateQuantityMilli), receivedAt: receivedAt ? jakartaMidnight(receivedAt) : null, updatedAt: new Date() }).where(eq(schema.deliveries.id, mutation.delivery.id)).returning(deliveryColumns);
        await tx.insert(schema.auditEvents).values({ eventNumber: displayNumber("AUD"), idempotencyKey: mutation.idempotencyKey, actorId: actor.id, entityType: "delivery", entityId: mutation.delivery.id, action: mutation.action, reason: mutation.notes ?? null, before: { status: mutation.delivery.status, receivedCrateQuantityMilli: mutation.delivery.receivedCrateQuantityMilli }, after: { status: mutation.status, receivedCrateQuantityMilli: mutation.receivedCrateQuantityMilli } });
        return toDelivery(row);
      });
    } catch (error) {
      dbError(error);
    }
  }

  async findCrateMovementByIdempotencyKey(key: string): Promise<CrateMovementRecord | null> {
    try {
      const [row] = await this.db.select(movementColumns).from(schema.crateMovements).where(eq(schema.crateMovements.idempotencyKey, key)).limit(1);
      return row ? toMovement(row) : null;
    } catch (error) {
      dbError(error);
    }
  }

  async getCrateAccount(customerId: string): Promise<CrateBalance | null> {
    try {
      const [customer] = await this.db.select({ id: schema.customers.id, customerNumber: schema.customers.customerNumber, name: schema.customers.name }).from(schema.customers).where(eq(schema.customers.id, customerId)).limit(1);
      if (!customer) return null;
      const [row] = await this.db.select({ balance: crateBalance }).from(schema.crateMovements).where(eq(schema.crateMovements.customerId, customerId));
      return { customerId: customer.id, customerNumber: customer.customerNumber, customerName: customer.name, balanceMilli: quantityToMilli(row.balance) };
    } catch (error) {
      dbError(error);
    }
  }

  async listCrateBalances(input: { query: string; limit: number; offset: number }): Promise<CrateBalance[]> {
    try {
      const search = input.query ? or(ilike(schema.customers.name, `%${input.query}%`), ilike(schema.customers.customerNumber, `%${input.query}%`)) : undefined;
      const rows = await this.db
        .select({ customerId: schema.customers.id, customerNumber: schema.customers.customerNumber, customerName: schema.customers.name, balance: crateBalance })
        .from(schema.customers)
        .leftJoin(schema.crateMovements, eq(schema.crateMovements.customerId, schema.customers.id))
        .where(and(eq(schema.customers.isActive, true), search))
        .groupBy(schema.customers.id, schema.customers.customerNumber, schema.customers.name)
        .having(sql`${crateBalance} <> 0`)
        .orderBy(desc(crateBalance), schema.customers.name)
        .limit(input.limit)
        .offset(input.offset);
      return rows.map((row) => ({ customerId: row.customerId, customerNumber: row.customerNumber, customerName: row.customerName, balanceMilli: quantityToMilli(row.balance) }));
    } catch (error) {
      dbError(error);
    }
  }

  async listCrateMovements(input: { customerId: string; limit: number; offset: number }): Promise<CrateMovementRecord[]> {
    try {
      const rows = await this.db.select(movementColumns).from(schema.crateMovements).where(eq(schema.crateMovements.customerId, input.customerId)).orderBy(desc(schema.crateMovements.occurredAt), desc(schema.crateMovements.createdAt)).limit(input.limit).offset(input.offset);
      return rows.map(toMovement);
    } catch (error) {
      dbError(error);
    }
  }

  async recordCrateReturnAtomic(input: CrateReturnInput, balanceMilli: number, actor: OwnerProfile): Promise<CrateMovementRecord> {
    try {
      return await this.db.transaction(async (tx) => {
        const movementNumber = displayNumber("CRT");
        const crateQuantityMilli = quantityToMilli(input.crateQuantity);
        const [row] = await tx.insert(schema.crateMovements).values({ movementNumber, customerId: input.customerId, type: "return", quantity: milliToQuantity(crateQuantityMilli), occurredAt: jakartaMidnight(input.occurredAt), reason: input.notes ?? null, idempotencyKey: input.idempotencyKey }).returning(movementColumns);
        await tx.insert(schema.auditEvents).values({ eventNumber: displayNumber("AUD"), idempotencyKey: input.idempotencyKey, actorId: actor.id, entityType: "crate_movement", entityId: row.id, action: "crate.returned", reason: input.notes ?? null, before: { balanceMilli }, after: { balanceMilli: balanceMilli - crateQuantityMilli } });
        return toMovement(row);
      });
    } catch (error) {
      dbError(error);
    }
  }
}
