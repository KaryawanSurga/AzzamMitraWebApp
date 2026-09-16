import "server-only";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import type { CapitalMovementCreateInput, CapitalMovementRecord, ExpenseCreateInput, ExpenseRecord, FinanceListInput } from "@/domain/finance";
import type { OwnerProfile } from "@/lib/auth/owner";
import { toRepositoryError } from "@/server/errors";
import type { F4Repository } from "./repository";

type Db = NodePgDatabase<typeof schema>;
const displayNumber = (prefix: string) => `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
const toExpense = (row: typeof schema.expenses.$inferSelect): ExpenseRecord => ({ id: row.id, expenseNumber: row.expenseNumber, category: row.category, amountRupiah: row.amountRupiah, method: row.method, occurredAt: row.occurredAt.toISOString(), notes: row.notes });
const toCapital = (row: typeof schema.capitalMovements.$inferSelect): CapitalMovementRecord => ({ id: row.id, movementNumber: row.movementNumber, type: row.type, amountRupiah: row.amountRupiah, occurredAt: row.occurredAt.toISOString(), notes: row.notes });

export class DrizzleF4Repository implements F4Repository {
  constructor(private readonly db: Db) {}

  async findExpenseByIdempotencyKey(key: string) { try { const [row] = await this.db.select().from(schema.expenses).where(eq(schema.expenses.idempotencyKey, key)).limit(1); return row ? toExpense(row) : null; } catch (error) { toRepositoryError(error); } }
  async createExpenseAtomic(input: ExpenseCreateInput, actor: OwnerProfile): Promise<ExpenseRecord> {
    try { return await this.db.transaction(async (tx) => {
      const expenseNumber = displayNumber("EXP");
      const [row] = await tx.insert(schema.expenses).values({ expenseNumber, idempotencyKey: input.idempotencyKey, category: input.category, amountRupiah: input.amountRupiah, method: input.method, occurredAt: new Date(input.occurredAt), notes: input.notes }).returning();
      await tx.insert(schema.auditEvents).values({ eventNumber: displayNumber("AUD"), idempotencyKey: input.idempotencyKey, actorId: actor.id, entityType: "expense", entityId: row.id, action: "expense.created", after: { expenseNumber, category: input.category, amountRupiah: input.amountRupiah, method: input.method ?? null, occurredAt: input.occurredAt, notes: input.notes ?? null } });
      return toExpense(row);
    }); } catch (error) { toRepositoryError(error); }
  }
  async listExpenses(input: FinanceListInput) { try { const filters = and(input.from ? gte(schema.expenses.occurredAt, new Date(input.from)) : undefined, input.to ? lte(schema.expenses.occurredAt, new Date(input.to)) : undefined); const query = this.db.select().from(schema.expenses); const rows = await (filters ? query.where(filters) : query).orderBy(desc(schema.expenses.occurredAt), desc(schema.expenses.createdAt)).limit(input.limit).offset(input.offset); return rows.map(toExpense); } catch (error) { toRepositoryError(error); } }

  async findCapitalMovementByIdempotencyKey(key: string) { try { const [row] = await this.db.select().from(schema.capitalMovements).where(eq(schema.capitalMovements.idempotencyKey, key)).limit(1); return row ? toCapital(row) : null; } catch (error) { toRepositoryError(error); } }
  async createCapitalMovementAtomic(input: CapitalMovementCreateInput, actor: OwnerProfile): Promise<CapitalMovementRecord> {
    try { return await this.db.transaction(async (tx) => {
      const movementNumber = displayNumber("CAP");
      const [row] = await tx.insert(schema.capitalMovements).values({ movementNumber, idempotencyKey: input.idempotencyKey, type: input.type, amountRupiah: input.amountRupiah, occurredAt: new Date(input.occurredAt), notes: input.notes }).returning();
      await tx.insert(schema.auditEvents).values({ eventNumber: displayNumber("AUD"), idempotencyKey: input.idempotencyKey, actorId: actor.id, entityType: "capital_movement", entityId: row.id, action: input.type === "capital_in" ? "capital.in.created" : "owner.draw.created", after: { movementNumber, type: input.type, amountRupiah: input.amountRupiah, occurredAt: input.occurredAt, notes: input.notes ?? null } });
      return toCapital(row);
    }); } catch (error) { toRepositoryError(error); }
  }
  async listCapitalMovements(input: FinanceListInput) { try { const filters = and(input.from ? gte(schema.capitalMovements.occurredAt, new Date(input.from)) : undefined, input.to ? lte(schema.capitalMovements.occurredAt, new Date(input.to)) : undefined); const query = this.db.select().from(schema.capitalMovements); const rows = await (filters ? query.where(filters) : query).orderBy(desc(schema.capitalMovements.occurredAt), desc(schema.capitalMovements.createdAt)).limit(input.limit).offset(input.offset); return rows.map(toCapital); } catch (error) { toRepositoryError(error); } }
}
