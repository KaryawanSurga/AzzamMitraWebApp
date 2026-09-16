import "server-only";
import type { CapitalMovementCreateInput, CapitalMovementRecord, ExpenseCreateInput, ExpenseRecord, FinanceListInput } from "@/domain/finance";
import type { OwnerProfile } from "@/lib/auth/owner";

export type { CapitalMovementRecord, ExpenseRecord };
export { RepositoryConflictError, RepositoryUnavailableError } from "@/server/errors";

export interface F4Repository {
  findExpenseByIdempotencyKey(key: string): Promise<ExpenseRecord | null>;
  createExpenseAtomic(input: ExpenseCreateInput, actor: OwnerProfile): Promise<ExpenseRecord>;
  listExpenses(input: FinanceListInput): Promise<ExpenseRecord[]>;
  findCapitalMovementByIdempotencyKey(key: string): Promise<CapitalMovementRecord | null>;
  createCapitalMovementAtomic(input: CapitalMovementCreateInput, actor: OwnerProfile): Promise<CapitalMovementRecord>;
  listCapitalMovements(input: FinanceListInput): Promise<CapitalMovementRecord[]>;
}
