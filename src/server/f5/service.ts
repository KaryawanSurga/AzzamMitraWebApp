import "server-only";
import {
  aggregateDashboardCashflow,
  buildDashboardActions,
  buildDashboardComparison,
  buildExpenseBreakdown,
  buildPeriodReport,
  dashboardDateRange,
  dashboardQuerySchema,
  reportDateRange,
  reportQuerySchema,
  type DashboardOverview,
  type PeriodReport,
} from "@/domain/reports";
import type { OwnerProfile } from "@/lib/auth/owner";
import { unauthorizedResult, validationFailure, type AppResult } from "@/server/result";
import type { F5Repository } from "./repository";

export class F5Service {
  constructor(
    private readonly repository: F5Repository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getDashboardOverview(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<DashboardOverview>> {
    if (!owner) return unauthorizedResult();
    const parsed = dashboardQuerySchema.safeParse(raw);
    if (!parsed.success) return validationFailure(parsed.error);

    const current = this.now();
    const range = dashboardDateRange(parsed.data.days, current);
    const previousRange = dashboardDateRange(parsed.data.days, new Date(current.getTime() - parsed.data.days * 86_400_000));
    try {
      const [sales, payments, expenses, receivables, undelivered, crates, previousSales, previousPayments, previousExpenses] = await Promise.all([
        this.repository.listSales(range.fromDate, range.toDate),
        this.repository.listPayments(range.fromDate, range.toDate),
        this.repository.listExpenses(range.fromDate, range.toDate),
        this.repository.listReceivables(range.toDate),
        this.repository.listUndelivered(),
        this.repository.listCrateOutstanding(),
        this.repository.listSales(previousRange.fromDate, previousRange.toDate),
        this.repository.listPayments(previousRange.fromDate, previousRange.toDate),
        this.repository.listExpenses(previousRange.fromDate, previousRange.toDate),
      ]);
      const cashflow = aggregateDashboardCashflow(parsed.data.days, sales, payments, expenses, current);
      const report = buildPeriodReport(range, sales, payments, expenses, receivables);
      const actionSummary = buildDashboardActions(receivables, undelivered, crates, range.to);
      const sum = (events: Array<{ amountRupiah: number }>) => events.reduce((total, event) => total + event.amountRupiah, 0);
      return {
        ok: true,
        data: {
          ...cashflow,
          totalSalesRupiah: report.totalSalesRupiah,
          totalReceivablesRupiah: report.totalReceivablesRupiah,
          estimatedNetProfitRupiah: report.estimatedNetProfitRupiah,
          comparison: buildDashboardComparison(
            { incomeRupiah: report.totalIncomeRupiah, expenseRupiah: report.totalExpenseRupiah, salesRupiah: report.totalSalesRupiah },
            { incomeRupiah: sum(previousPayments), expenseRupiah: sum(previousExpenses), salesRupiah: sum(previousSales) },
          ),
          expenseBreakdown: buildExpenseBreakdown(expenses),
          actions: actionSummary.actions.slice(0, 8),
          actionCounts: actionSummary.actionCounts,
        },
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

  async getPeriodReport(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<PeriodReport>> {
    if (!owner) return unauthorizedResult();
    const parsed = reportQuerySchema.safeParse(raw);
    if (!parsed.success) return validationFailure(parsed.error);

    const range = reportDateRange(parsed.data, this.now());
    try {
      const [sales, payments, expenses, receivables] = await Promise.all([
        this.repository.listSales(range.fromDate, range.toDate),
        this.repository.listPayments(range.fromDate, range.toDate),
        this.repository.listExpenses(range.fromDate, range.toDate),
        this.repository.listReceivables(range.toDate),
      ]);
      return { ok: true, data: buildPeriodReport(range, sales, payments, expenses, receivables) };
    } catch {
      return {
        ok: false,
        error: {
          code: "retryable",
          message: "Laporan periode belum dapat dimuat. Silakan coba lagi.",
        },
      };
    }
  }
}
