import "server-only";
import { and, asc, between, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { quantityToMilli } from "@/domain/contracts";
import { toRepositoryError } from "@/server/errors";
import type { F5Repository } from "./repository";

type Db = NodePgDatabase<typeof schema>;
const reportableSaleStatuses = ["confirmed", "completed"] as const;

export class DrizzleF5Repository implements F5Repository {
  constructor(private readonly db: Db) {}

  async listSales(from: Date, to: Date) {
    try {
      const rows = await this.db
        .select({
          id: schema.sales.id,
          reference: schema.sales.invoiceNumber,
          customerName: schema.customers.name,
          amountRupiah: schema.sales.totalRupiah,
          occurredAt: schema.sales.transactionDate,
        })
        .from(schema.sales)
        .innerJoin(schema.customers, eq(schema.sales.customerId, schema.customers.id))
        .where(and(inArray(schema.sales.status, reportableSaleStatuses), between(schema.sales.transactionDate, from, to)))
        .orderBy(asc(schema.sales.transactionDate));
      return rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() }));
    } catch (error) {
      toRepositoryError(error);
    }
  }

  async listPayments(from: Date, to: Date) {
    try {
      const rows = await this.db
        .select({
          reference: schema.payments.paymentNumber,
          invoiceNumber: schema.sales.invoiceNumber,
          customerName: schema.customers.name,
          amountRupiah: schema.payments.amountRupiah,
          occurredAt: schema.payments.paidAt,
        })
        .from(schema.payments)
        .innerJoin(schema.sales, eq(schema.payments.saleId, schema.sales.id))
        .innerJoin(schema.customers, eq(schema.sales.customerId, schema.customers.id))
        .where(between(schema.payments.paidAt, from, to))
        .orderBy(asc(schema.payments.paidAt));
      return rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() }));
    } catch (error) {
      toRepositoryError(error);
    }
  }

  async listExpenses(from: Date, to: Date) {
    try {
      const rows = await this.db
        .select({
          reference: schema.expenses.expenseNumber,
          category: schema.expenses.category,
          notes: schema.expenses.notes,
          amountRupiah: schema.expenses.amountRupiah,
          occurredAt: schema.expenses.occurredAt,
        })
        .from(schema.expenses)
        .where(between(schema.expenses.occurredAt, from, to))
        .orderBy(asc(schema.expenses.occurredAt));
      return rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() }));
    } catch (error) {
      toRepositoryError(error);
    }
  }

  async listReceivables(asOf: Date) {
    try {
      const paidAsOf = this.db
        .select({
          saleId: schema.payments.saleId,
          amountRupiah: sql<string>`sum(${schema.payments.amountRupiah})`.as("amount_rupiah"),
        })
        .from(schema.payments)
        .where(lte(schema.payments.paidAt, asOf))
        .groupBy(schema.payments.saleId)
        .as("paid_as_of");
      const outstanding = sql<string>`${schema.sales.totalRupiah} - coalesce(${paidAsOf.amountRupiah}, 0)`;
      const rows = await this.db
        .select({
          saleId: schema.sales.id,
          invoiceNumber: schema.sales.invoiceNumber,
          customerName: schema.customers.name,
          dueDate: schema.sales.dueDate,
          outstandingRupiah: outstanding,
        })
        .from(schema.sales)
        .innerJoin(schema.customers, eq(schema.sales.customerId, schema.customers.id))
        .leftJoin(paidAsOf, eq(schema.sales.id, paidAsOf.saleId))
        .where(and(
          inArray(schema.sales.status, reportableSaleStatuses),
          lte(schema.sales.transactionDate, asOf),
          gt(outstanding, 0),
        ))
        .orderBy(asc(schema.sales.dueDate), asc(schema.sales.transactionDate));
      return rows.map((row) => ({ ...row, outstandingRupiah: Number(row.outstandingRupiah) }));
    } catch (error) {
      toRepositoryError(error);
    }
  }

  async listUndelivered() {
    try {
      const itemTotals = this.db
        .select({
          saleId: schema.saleItems.saleId,
          crateQuantity: sql<string>`sum(coalesce(${schema.saleItems.crateQuantity}, 0))`.as("crate_quantity"),
        })
        .from(schema.saleItems)
        .groupBy(schema.saleItems.saleId)
        .as("item_totals");
      const deliveryTotals = this.db
        .select({
          saleId: schema.deliveries.saleId,
          receivedQuantity: sql<string>`sum(${schema.deliveries.receivedCrateQuantity})`.as("received_quantity"),
        })
        .from(schema.deliveries)
        .groupBy(schema.deliveries.saleId)
        .as("delivery_totals");
      const outstanding = sql<string>`${itemTotals.crateQuantity} - coalesce(${deliveryTotals.receivedQuantity}, 0)`;
      const rows = await this.db
        .select({
          saleId: schema.sales.id,
          invoiceNumber: schema.sales.invoiceNumber,
          customerName: schema.customers.name,
          outstandingCrateQuantity: outstanding,
        })
        .from(schema.sales)
        .innerJoin(schema.customers, eq(schema.sales.customerId, schema.customers.id))
        .innerJoin(itemTotals, eq(schema.sales.id, itemTotals.saleId))
        .leftJoin(deliveryTotals, eq(schema.sales.id, deliveryTotals.saleId))
        .where(and(eq(schema.sales.status, "confirmed"), gt(outstanding, 0)))
        .orderBy(asc(schema.sales.transactionDate));
      return rows.map((row) => ({ ...row, outstandingCrateMilli: quantityToMilli(row.outstandingCrateQuantity) }));
    } catch (error) {
      toRepositoryError(error);
    }
  }

  async listCrateOutstanding() {
    try {
      const balance = sql<string>`coalesce(sum(case when ${schema.crateMovements.type} = 'return' then -${schema.crateMovements.quantity} else ${schema.crateMovements.quantity} end) filter (where ${schema.crateMovements.type} <> 'adjustment'), 0)`;
      const rows = await this.db
        .select({
          customerId: schema.customers.id,
          customerName: schema.customers.name,
          balance,
        })
        .from(schema.customers)
        .innerJoin(schema.crateMovements, eq(schema.customers.id, schema.crateMovements.customerId))
        .where(eq(schema.customers.isActive, true))
        .groupBy(schema.customers.id, schema.customers.name)
        .having(gt(balance, 0))
        .orderBy(desc(balance), asc(schema.customers.name));
      return rows.map((row) => ({ customerId: row.customerId, customerName: row.customerName, balanceMilli: quantityToMilli(row.balance) }));
    } catch (error) {
      toRepositoryError(error);
    }
  }
}
