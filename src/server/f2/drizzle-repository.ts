import "server-only";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import type { OwnerProfile } from "@/lib/auth/owner";
import { derivePaymentStatus, jakartaDate, type SaleMutationInput } from "@/domain/sales";
import { milliToQuantity } from "@/domain/contracts";
import { sumCrateMilli } from "@/domain/crates";
import { type CalculatedSale, type CustomerRecord, type F2Repository, type SaleCorrectionPersistInput, type SaleRecord } from "./repository";
import { toRepositoryError } from "@/server/errors";

type Db = NodePgDatabase<typeof schema>;
const customerColumns = { id: schema.customers.id, customerNumber: schema.customers.customerNumber, name: schema.customers.name, whatsapp: schema.customers.whatsapp, address: schema.customers.address, notes: schema.customers.notes, isActive: schema.customers.isActive };
const displayNumber = (prefix: string) => `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
const dbError: (error: unknown) => never = toRepositoryError;

const saleChangeColumns = {
  id: schema.sales.id, invoiceNumber: schema.sales.invoiceNumber, idempotencyKey: schema.sales.idempotencyKey,
  status: schema.sales.status, dueDate: schema.sales.dueDate, subtotalRupiah: schema.sales.subtotalRupiah,
  discountRupiah: schema.sales.discountRupiah, feeRupiah: schema.sales.feeRupiah, totalRupiah: schema.sales.totalRupiah,
  notes: schema.sales.notes,
};

function auditSnapshot(sale: { status: string; subtotalRupiah: number; discountRupiah: number; feeRupiah: number; totalRupiah: number; dueDate: string | null; notes: string | null }) {
  return { status: sale.status, subtotalRupiah: sale.subtotalRupiah, discountRupiah: sale.discountRupiah, feeRupiah: sale.feeRupiah, totalRupiah: sale.totalRupiah, dueDate: sale.dueDate, notes: sale.notes };
}

export class DrizzleF2Repository implements F2Repository {
  constructor(private readonly db: Db) {}

  async findCustomerByIdempotencyKey(key: string): Promise<CustomerRecord | null> { try { const [created] = await this.db.select(customerColumns).from(schema.customers).where(eq(schema.customers.createIdempotencyKey, key)).limit(1); if (created) return created; const [event] = await this.db.select({ entityId: schema.auditEvents.entityId }).from(schema.auditEvents).where(and(eq(schema.auditEvents.idempotencyKey, key), eq(schema.auditEvents.entityType, "customer"))).limit(1); return event ? this.getCustomer(event.entityId) : null; } catch (error) { dbError(error); } }
  async createCustomer(input: { idempotencyKey: string; name: string; whatsapp?: string; address?: string; notes?: string }, actor: OwnerProfile): Promise<CustomerRecord> { try { return await this.db.transaction(async (tx) => { const { idempotencyKey, ...values } = input; const [record] = await tx.insert(schema.customers).values({ ...values, createIdempotencyKey: idempotencyKey, customerNumber: displayNumber("CUS") }).returning(customerColumns); await tx.insert(schema.auditEvents).values({ eventNumber: displayNumber("AUD"), idempotencyKey, actorId: actor.id, entityType: "customer", entityId: record.id, action: "customer.created", after: record }); return record; }); } catch (error) { dbError(error); } }
  async updateCustomer(input: { id: string; idempotencyKey: string; name?: string; whatsapp?: string; address?: string; notes?: string }, actor: OwnerProfile): Promise<CustomerRecord | null> { try { return await this.db.transaction(async (tx) => { const [before] = await tx.select(customerColumns).from(schema.customers).where(eq(schema.customers.id, input.id)).limit(1); if (!before) return null; const { id, idempotencyKey, ...changes } = input; const [record] = await tx.update(schema.customers).set({ ...changes, updatedAt: new Date() }).where(eq(schema.customers.id, id)).returning(customerColumns); await tx.insert(schema.auditEvents).values({ eventNumber: displayNumber("AUD"), idempotencyKey, actorId: actor.id, entityType: "customer", entityId: id, action: "customer.updated", before, after: record }); return record; }); } catch (error) { dbError(error); } }
  async setCustomerActive(id: string, isActive: boolean, idempotencyKey: string, actor: OwnerProfile): Promise<CustomerRecord | null> { try { return await this.db.transaction(async (tx) => { const [before] = await tx.select(customerColumns).from(schema.customers).where(eq(schema.customers.id, id)).limit(1); if (!before) return null; const [record] = await tx.update(schema.customers).set({ isActive, updatedAt: new Date() }).where(eq(schema.customers.id, id)).returning(customerColumns); await tx.insert(schema.auditEvents).values({ eventNumber: displayNumber("AUD"), idempotencyKey, actorId: actor.id, entityType: "customer", entityId: id, action: isActive ? "customer.enabled" : "customer.archived", before, after: record }); return record; }); } catch (error) { dbError(error); } }
  async listCustomers(input: { query: string; includeArchived: boolean; limit: number; offset: number }): Promise<CustomerRecord[]> { try { const search = input.query ? or(ilike(schema.customers.name, `%${input.query}%`), ilike(schema.customers.customerNumber, `%${input.query}%`), ilike(schema.customers.whatsapp, `%${input.query}%`)) : undefined; const active = input.includeArchived ? undefined : eq(schema.customers.isActive, true); return await this.db.select(customerColumns).from(schema.customers).where(and(active, search)).orderBy(schema.customers.name).limit(input.limit).offset(input.offset); } catch (error) { dbError(error); } }
  async getCustomer(id: string): Promise<CustomerRecord | null> { try { const [record] = await this.db.select(customerColumns).from(schema.customers).where(eq(schema.customers.id, id)).limit(1); return record ?? null; } catch (error) { dbError(error); } }
  async findSaleByIdempotencyKey(key: string, today: string): Promise<SaleRecord | null> { try { const [sale] = await this.db.select({ id: schema.sales.id, invoiceNumber: schema.sales.invoiceNumber, idempotencyKey: schema.sales.idempotencyKey, totalRupiah: schema.sales.totalRupiah, dueDate: schema.sales.dueDate, status: schema.sales.status }).from(schema.sales).where(eq(schema.sales.idempotencyKey, key)).limit(1); if (!sale) return null; const rows = await this.db.select({ amount: schema.payments.amountRupiah }).from(schema.payments).where(eq(schema.payments.saleId, sale.id)); const paidRupiah = rows.reduce((sum, row) => sum + row.amount, 0); const remainingRupiah = sale.totalRupiah - paidRupiah; return { ...sale, paidRupiah, remainingRupiah, paymentStatus: derivePaymentStatus(remainingRupiah, paidRupiah, sale.dueDate, today), status: sale.status as SaleRecord["status"] }; } catch (error) { dbError(error); } }
  async createSaleAtomic(input: SaleMutationInput, calculated: CalculatedSale, actor: OwnerProfile): Promise<SaleRecord> {
    try {
      return await this.db.transaction(async (tx) => {
        const invoiceNumber = displayNumber("INV");
        const [sale] = await tx.insert(schema.sales).values({ invoiceNumber, idempotencyKey: input.idempotencyKey, customerId: input.customerId, status: input.status, paymentStatus: calculated.paymentStatus, transactionDate: new Date(`${input.transactionDate}T00:00:00+07:00`), dueDate: input.dueDate, subtotalRupiah: calculated.subtotalRupiah, discountRupiah: input.discountRupiah, feeRupiah: input.feeRupiah, totalRupiah: calculated.totalRupiah, notes: input.notes, confirmedAt: input.status === "confirmed" ? new Date() : null }).returning({ id: schema.sales.id });
        await tx.insert(schema.saleItems).values(calculated.items.map((item) => ({ saleId: sale.id, descriptionSnapshot: item.description, pricingBasis: item.pricingBasis, unitSnapshot: item.unitSnapshot, crateQuantity: item.crateQuantity, weightKg: item.weightKg, pricingQuantity: item.pricingQuantity, unitPriceRupiah: item.unitPriceRupiah, subtotalRupiah: item.subtotalRupiah })));
        if (calculated.paidRupiah > 0) await tx.insert(schema.payments).values({ paymentNumber: displayNumber("PAY"), saleId: sale.id, amountRupiah: calculated.paidRupiah, method: input.paymentMethod!, paidAt: new Date(), idempotencyKey: `${input.idempotencyKey}:initial` });
        /* Peti yang dibawa pelanggan dicatat saat penjualan dikonfirmasi. Draft belum menambah saldo, dan pengiriman hanya menggerakkan barang. */
        const crateQuantityMilli = sumCrateMilli(calculated.items);
        if (input.status === "confirmed" && crateQuantityMilli > 0) await tx.insert(schema.crateMovements).values({ movementNumber: displayNumber("CRT"), customerId: input.customerId, saleId: sale.id, type: "out", quantity: milliToQuantity(crateQuantityMilli), occurredAt: new Date(`${input.transactionDate}T00:00:00+07:00`), idempotencyKey: `${input.idempotencyKey}:crate-out` });
        await tx.insert(schema.auditEvents).values({ eventNumber: displayNumber("AUD"), idempotencyKey: input.idempotencyKey, actorId: actor.id, entityType: "sale", entityId: sale.id, action: input.status === "confirmed" ? "sale.confirmed" : "sale.drafted", after: { invoiceNumber, totalRupiah: calculated.totalRupiah, paidRupiah: calculated.paidRupiah, crateQuantityMilli } });
        return { id: sale.id, invoiceNumber, idempotencyKey: input.idempotencyKey, totalRupiah: calculated.totalRupiah, paidRupiah: calculated.paidRupiah, remainingRupiah: calculated.remainingRupiah, dueDate: input.dueDate ?? null, paymentStatus: calculated.paymentStatus, status: input.status };
      });
    } catch (error) {
      dbError(error);
    }
  }
  async listSales(input: { query: string; limit: number; offset: number }, today: string) { try { const search = input.query ? or(ilike(schema.sales.invoiceNumber, `%${input.query}%`), ilike(schema.customers.name, `%${input.query}%`)) : undefined; const rows = await this.db.select({ id: schema.sales.id, invoiceNumber: schema.sales.invoiceNumber, idempotencyKey: schema.sales.idempotencyKey, totalRupiah: schema.sales.totalRupiah, dueDate: schema.sales.dueDate, status: schema.sales.status, customerName: schema.customers.name, transactionDate: schema.sales.transactionDate }).from(schema.sales).innerJoin(schema.customers, eq(schema.sales.customerId, schema.customers.id)).where(search).orderBy(desc(schema.sales.transactionDate)).limit(input.limit).offset(input.offset); return Promise.all(rows.map(async (sale) => { const payments = await this.db.select({ amount: schema.payments.amountRupiah }).from(schema.payments).where(eq(schema.payments.saleId, sale.id)); const paidRupiah = payments.reduce((sum, row) => sum + row.amount, 0); const remainingRupiah = sale.totalRupiah - paidRupiah; return { ...sale, transactionDate: jakartaDate(sale.transactionDate), status: sale.status as SaleRecord["status"], paidRupiah, remainingRupiah, paymentStatus: derivePaymentStatus(remainingRupiah, paidRupiah, sale.dueDate, today) }; })); } catch (error) { dbError(error); } }
  async getSale(id: string, today: string) { try { const [sale] = await this.db.select({ id: schema.sales.id, invoiceNumber: schema.sales.invoiceNumber, idempotencyKey: schema.sales.idempotencyKey, customerId: schema.sales.customerId, customerName: schema.customers.name, customerNumber: schema.customers.customerNumber, transactionDate: schema.sales.transactionDate, subtotalRupiah: schema.sales.subtotalRupiah, discountRupiah: schema.sales.discountRupiah, feeRupiah: schema.sales.feeRupiah, totalRupiah: schema.sales.totalRupiah, dueDate: schema.sales.dueDate, status: schema.sales.status, notes: schema.sales.notes, cancelledAt: schema.sales.cancelledAt }).from(schema.sales).innerJoin(schema.customers, eq(schema.sales.customerId, schema.customers.id)).where(eq(schema.sales.id, id)).limit(1); if (!sale) return null; const [items, payments] = await Promise.all([this.db.select({ id: schema.saleItems.id, description: schema.saleItems.descriptionSnapshot, pricingBasis: schema.saleItems.pricingBasis, crateQuantity: schema.saleItems.crateQuantity, weightKg: schema.saleItems.weightKg, unitPriceRupiah: schema.saleItems.unitPriceRupiah, subtotalRupiah: schema.saleItems.subtotalRupiah }).from(schema.saleItems).where(eq(schema.saleItems.saleId, id)), this.db.select({ id: schema.payments.id, amountRupiah: schema.payments.amountRupiah, method: schema.payments.method, paidAt: schema.payments.paidAt }).from(schema.payments).where(eq(schema.payments.saleId, id))]); const paidRupiah = payments.reduce((sum, row) => sum + row.amountRupiah, 0); const remainingRupiah = sale.totalRupiah - paidRupiah; return { ...sale, transactionDate: jakartaDate(sale.transactionDate), status: sale.status as SaleRecord["status"], cancelledAt: sale.cancelledAt ? sale.cancelledAt.toISOString() : null, paidRupiah, remainingRupiah, paymentStatus: derivePaymentStatus(remainingRupiah, paidRupiah, sale.dueDate, today), items, payments: payments.map((payment) => ({ ...payment, paidAt: payment.paidAt.toISOString() })) }; } catch (error) { dbError(error); } }

  async findAdjustmentByIdempotencyKey(key: string): Promise<{ saleId: string } | null> { try { const [record] = await this.db.select({ saleId: schema.adjustments.saleId }).from(schema.adjustments).where(eq(schema.adjustments.idempotencyKey, key)).limit(1); return record ?? null; } catch (error) { dbError(error); } }

  async cancelSaleAtomic(input: { saleId: string; idempotencyKey: string; reason: string }, actor: OwnerProfile, today: string): Promise<SaleRecord | null> {
    try {
      return await this.db.transaction(async (tx) => {
        const [before] = await tx.select(saleChangeColumns).from(schema.sales).where(eq(schema.sales.id, input.saleId)).limit(1).for("update");
        if (!before) return null;
        const payments = await tx.select({ amount: schema.payments.amountRupiah }).from(schema.payments).where(eq(schema.payments.saleId, input.saleId));
        const paidRupiah = payments.reduce((sum, row) => sum + row.amount, 0);
        const cancelledAt = new Date();
        const [after] = await tx.update(schema.sales).set({ status: "cancelled", cancelledAt, updatedAt: cancelledAt }).where(eq(schema.sales.id, input.saleId)).returning(saleChangeColumns);
        await tx.insert(schema.adjustments).values({ adjustmentNumber: displayNumber("ADJ"), idempotencyKey: input.idempotencyKey, saleId: input.saleId, type: "cancellation", amountRupiah: before.totalRupiah, reason: input.reason, occurredAt: cancelledAt, createdBy: actor.id });
        await tx.insert(schema.auditEvents).values({ eventNumber: displayNumber("AUD"), idempotencyKey: input.idempotencyKey, actorId: actor.id, entityType: "sale", entityId: input.saleId, action: "sale.cancelled", before: auditSnapshot(before), after: auditSnapshot(after), reason: input.reason });
        const remainingRupiah = after.totalRupiah - paidRupiah;
        return { id: after.id, invoiceNumber: after.invoiceNumber, idempotencyKey: after.idempotencyKey, totalRupiah: after.totalRupiah, paidRupiah, remainingRupiah, dueDate: after.dueDate, paymentStatus: derivePaymentStatus(remainingRupiah, paidRupiah, after.dueDate, today), status: "cancelled" as const };
      });
    } catch (error) { dbError(error); }
  }

  async correctSaleAtomic(input: SaleCorrectionPersistInput, actor: OwnerProfile, today: string): Promise<SaleRecord | null> {
    try {
      return await this.db.transaction(async (tx) => {
        const [before] = await tx.select(saleChangeColumns).from(schema.sales).where(eq(schema.sales.id, input.saleId)).limit(1).for("update");
        if (!before) return null;
        const payments = await tx.select({ amount: schema.payments.amountRupiah }).from(schema.payments).where(eq(schema.payments.saleId, input.saleId));
        const paidRupiah = payments.reduce((sum, row) => sum + row.amount, 0);
        const correctedAt = new Date();
        const [after] = await tx.update(schema.sales).set({ discountRupiah: input.discountRupiah, feeRupiah: input.feeRupiah, totalRupiah: input.totalRupiah, dueDate: input.dueDate, notes: input.notes, updatedAt: correctedAt }).where(eq(schema.sales.id, input.saleId)).returning(saleChangeColumns);
        await tx.insert(schema.adjustments).values({ adjustmentNumber: displayNumber("ADJ"), idempotencyKey: input.idempotencyKey, saleId: input.saleId, type: "correction", amountRupiah: Math.abs(after.totalRupiah - before.totalRupiah), reason: input.reason, occurredAt: correctedAt, createdBy: actor.id });
        await tx.insert(schema.auditEvents).values({ eventNumber: displayNumber("AUD"), idempotencyKey: input.idempotencyKey, actorId: actor.id, entityType: "sale", entityId: input.saleId, action: "sale.corrected", before: auditSnapshot(before), after: { ...auditSnapshot(after), changes: input.changes }, reason: input.reason });
        const remainingRupiah = after.totalRupiah - paidRupiah;
        return { id: after.id, invoiceNumber: after.invoiceNumber, idempotencyKey: after.idempotencyKey, totalRupiah: after.totalRupiah, paidRupiah, remainingRupiah, dueDate: after.dueDate, paymentStatus: derivePaymentStatus(remainingRupiah, paidRupiah, after.dueDate, today), status: after.status as SaleRecord["status"] };
      });
    } catch (error) { dbError(error); }
  }

  async listSaleAdjustments(saleId: string) { try { const rows = await this.db.select({ id: schema.adjustments.id, adjustmentNumber: schema.adjustments.adjustmentNumber, type: schema.adjustments.type, amountRupiah: schema.adjustments.amountRupiah, reason: schema.adjustments.reason, occurredAt: schema.adjustments.occurredAt, actorName: schema.users.displayName }).from(schema.adjustments).innerJoin(schema.users, eq(schema.adjustments.createdBy, schema.users.id)).where(eq(schema.adjustments.saleId, saleId)).orderBy(desc(schema.adjustments.occurredAt)); return rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() })); } catch (error) { dbError(error); } }

  async listSaleAuditEvents(saleId: string) { try { const rows = await this.db.select({ id: schema.auditEvents.id, action: schema.auditEvents.action, reason: schema.auditEvents.reason, actorName: schema.users.displayName, occurredAt: schema.auditEvents.occurredAt }).from(schema.auditEvents).innerJoin(schema.users, eq(schema.auditEvents.actorId, schema.users.id)).where(and(eq(schema.auditEvents.entityType, "sale"), eq(schema.auditEvents.entityId, saleId))).orderBy(desc(schema.auditEvents.occurredAt)); return rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() })); } catch (error) { dbError(error); } }
}
