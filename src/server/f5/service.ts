import "server-only";
import {
  aggregateDashboardCashflow,
  buildDashboardActions,
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
    try {
      const [sales, payments, expenses, receivables, undelivered, crates] = await Promise.all([
        this.repository.listSales(range.fromDate, range.toDate),
        this.repository.listPayments(range.fromDate, range.toDate),
        this.repository.listExpenses(range.fromDate, range.toDate),
        this.repository.listReceivables(range.toDate),
        this.repository.listUndelivered(),
        this.repository.listCrateOutstanding(),
      ]);
      const cashflow = aggregateDashboardCashflow(parsed.data.days, payments, expenses, current);
      const report = buildPeriodReport(range, sales, payments, expenses, receivables);
      const actionSummary = buildDashboardActions(receivables, undelivered, crates, range.to);
      return {
        ok: true,
        data: {
          ...cashflow,
          totalSalesRupiah: report.totalSalesRupiah,
          totalReceivablesRupiah: report.totalReceivablesRupiah,
          estimatedNetProfitRupiah: report.estimatedNetProfitRupiah,
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
