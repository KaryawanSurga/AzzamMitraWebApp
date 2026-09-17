import "server-only";
import { asc, between } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { toRepositoryError } from "@/server/errors";
import type { F5Repository } from "./repository";

type Db = NodePgDatabase<typeof schema>;

export class DrizzleF5Repository implements F5Repository {
  constructor(private readonly db: Db) {}

  async listIncomeEvents(from: Date, to: Date) {
    try {
      const rows = await this.db
        .select({ amountRupiah: schema.payments.amountRupiah, occurredAt: schema.payments.paidAt })
        .from(schema.payments)
        .where(between(schema.payments.paidAt, from, to))
        .orderBy(asc(schema.payments.paidAt));
      return rows.map((row) => ({ amountRupiah: row.amountRupiah, occurredAt: row.occurredAt.toISOString() }));
    } catch (error) {
      toRepositoryError(error);
    }
  }

  async listExpenseEvents(from: Date, to: Date) {
    try {
      const rows = await this.db
        .select({ amountRupiah: schema.expenses.amountRupiah, occurredAt: schema.expenses.occurredAt })
        .from(schema.expenses)
        .where(between(schema.expenses.occurredAt, from, to))
        .orderBy(asc(schema.expenses.occurredAt));
      return rows.map((row) => ({ amountRupiah: row.amountRupiah, occurredAt: row.occurredAt.toISOString() }));
    } catch (error) {
      toRepositoryError(error);
    }
  }
}
