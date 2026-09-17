import "server-only";
import { aggregateDashboardCashflow, dashboardDateRange, dashboardQuerySchema, type DashboardCashflow } from "@/domain/reports";
import type { OwnerProfile } from "@/lib/auth/owner";
import { unauthorizedResult, validationFailure, type AppResult } from "@/server/result";
import type { F5Repository } from "./repository";

export class F5Service {
  constructor(
    private readonly repository: F5Repository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getDashboardCashflow(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<DashboardCashflow>> {
    if (!owner) return unauthorizedResult();
    const parsed = dashboardQuerySchema.safeParse(raw);
    if (!parsed.success) return validationFailure(parsed.error);

    const current = this.now();
    const range = dashboardDateRange(parsed.data.days, current);
    try {
      const [incomeEvents, expenseEvents] = await Promise.all([
        this.repository.listIncomeEvents(range.fromDate, range.toDate),
        this.repository.listExpenseEvents(range.fromDate, range.toDate),
      ]);
      return {
        ok: true,
        data: aggregateDashboardCashflow(parsed.data.days, incomeEvents, expenseEvents, current),
      };
    } catch {
      return {
        ok: false,
        error: {
          code: "retryable",
          message: "Ringkasan dashboard belum dapat dimuat. Silakan coba lagi.",
        },
      };
    }
  }
}
