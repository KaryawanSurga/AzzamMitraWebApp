import "server-only";
import { capitalMovementCreateSchema, capitalMovementListSchema, expenseCreateSchema, expenseListSchema, validateFinanceOccurredAt } from "@/domain/finance";
import type { OwnerProfile } from "@/lib/auth/owner";
import { fieldFailure, repositoryFailure, unauthorizedResult, validationFailure, type AppResult } from "@/server/result";
import { RepositoryConflictError, type CapitalMovementRecord, type ExpenseRecord, type F4Repository } from "./repository";

export class F4Service {
  constructor(private readonly repository: F4Repository, private readonly now: () => Date = () => new Date()) {}

  async createExpense(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<ExpenseRecord>> {
    if (!owner) return unauthorizedResult();
    const parsed = expenseCreateSchema.safeParse(raw);
    if (!parsed.success) return validationFailure(parsed.error);
    const dateError = validateFinanceOccurredAt(parsed.data.occurredAt, this.now());
    if (dateError) return fieldFailure("occurredAt", dateError);
    try { const existing = await this.repository.findExpenseByIdempotencyKey(parsed.data.idempotencyKey); if (existing) return { ok: true, data: existing }; return { ok: true, data: await this.repository.createExpenseAtomic(parsed.data, owner) }; }
    catch (error) { return this.sanitizedFailure(error, () => this.repository.findExpenseByIdempotencyKey(parsed.data.idempotencyKey)); }
  }

  async listExpenses(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<ExpenseRecord[]>> {
    if (!owner) return unauthorizedResult(); const parsed = expenseListSchema.safeParse(raw); if (!parsed.success) return validationFailure(parsed.error);
    try { return { ok: true, data: await this.repository.listExpenses(parsed.data) }; } catch { return { ok: false, error: { code: "retryable", message: "Daftar pengeluaran belum dapat dimuat. Silakan coba lagi." } }; }
  }

  async createCapitalMovement(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<CapitalMovementRecord>> {
    if (!owner) return unauthorizedResult();
    const parsed = capitalMovementCreateSchema.safeParse(raw); if (!parsed.success) return validationFailure(parsed.error);
    const dateError = validateFinanceOccurredAt(parsed.data.occurredAt, this.now()); if (dateError) return fieldFailure("occurredAt", dateError);
    try { const existing = await this.repository.findCapitalMovementByIdempotencyKey(parsed.data.idempotencyKey); if (existing) return { ok: true, data: existing }; return { ok: true, data: await this.repository.createCapitalMovementAtomic(parsed.data, owner) }; }
    catch (error) { return this.sanitizedFailure(error, () => this.repository.findCapitalMovementByIdempotencyKey(parsed.data.idempotencyKey)); }
  }

  async listCapitalMovements(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<CapitalMovementRecord[]>> {
    if (!owner) return unauthorizedResult(); const parsed = capitalMovementListSchema.safeParse(raw); if (!parsed.success) return validationFailure(parsed.error);
    try { return { ok: true, data: await this.repository.listCapitalMovements(parsed.data) }; } catch { return { ok: false, error: { code: "retryable", message: "Daftar pergerakan modal belum dapat dimuat. Silakan coba lagi." } }; }
  }

  private async sanitizedFailure<T>(error: unknown, lookup: () => Promise<T | null>): Promise<AppResult<T>> {
    if (error instanceof RepositoryConflictError) { try { const existing = await lookup(); if (existing) return { ok: true, data: existing }; } catch { /* disanitasi di bawah */ } }
    return repositoryFailure(error);
  }
}
