import "server-only";
import type { CashflowEvent } from "@/domain/reports";

export { RepositoryUnavailableError } from "@/server/errors";

export interface F5Repository {
  listIncomeEvents(from: Date, to: Date): Promise<CashflowEvent[]>;
  listExpenseEvents(from: Date, to: Date): Promise<CashflowEvent[]>;
}
