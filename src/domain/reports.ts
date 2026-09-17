import { z } from "zod";
import { jakartaDateTimeLocal } from "./finance";

export const dashboardPeriods = [7, 30, 90] as const;
export type DashboardPeriodDays = (typeof dashboardPeriods)[number];

export const dashboardQuerySchema = z.object({
  days: z.preprocess(
    (value) => value === undefined || value === "" ? 30 : Number(value),
    z.union([z.literal(7), z.literal(30), z.literal(90)], {
      error: "Periode dashboard harus 7, 30, atau 90 hari.",
    }),
  ),
});

export type CashflowEvent = {
  amountRupiah: number;
  occurredAt: string;
};

export type CashflowPoint = {
  date: string;
  incomeRupiah: number;
  expenseRupiah: number;
};

export type DashboardCashflow = {
  days: DashboardPeriodDays;
  from: string;
  to: string;
  totalIncomeRupiah: number;
  totalExpenseRupiah: number;
  netCashflowRupiah: number;
  points: CashflowPoint[];
};

export function dashboardDateRange(days: DashboardPeriodDays, now = new Date()) {
  const to = jakartaDateTimeLocal(now).slice(0, 10);
  const toMidnight = new Date(`${to}T00:00:00+07:00`);
  const fromMidnight = new Date(toMidnight.getTime() - (days - 1) * 86_400_000);
  const from = jakartaDateTimeLocal(fromMidnight).slice(0, 10);
  return {
    from,
    to,
    fromDate: new Date(`${from}T00:00:00+07:00`),
    toDate: new Date(`${to}T23:59:59.999+07:00`),
  };
}

export function aggregateDashboardCashflow(
  days: DashboardPeriodDays,
  incomeEvents: CashflowEvent[],
  expenseEvents: CashflowEvent[],
  now = new Date(),
): DashboardCashflow {
  const range = dashboardDateRange(days, now);
  const points = new Map<string, CashflowPoint>();
  const start = new Date(`${range.from}T00:00:00+07:00`).getTime();

  for (let index = 0; index < days; index += 1) {
    const date = jakartaDateTimeLocal(new Date(start + index * 86_400_000)).slice(0, 10);
    points.set(date, { date, incomeRupiah: 0, expenseRupiah: 0 });
  }

  for (const event of incomeEvents) {
    const date = jakartaDateTimeLocal(new Date(event.occurredAt)).slice(0, 10);
    const point = points.get(date);
    if (point) point.incomeRupiah += event.amountRupiah;
  }
  for (const event of expenseEvents) {
    const date = jakartaDateTimeLocal(new Date(event.occurredAt)).slice(0, 10);
    const point = points.get(date);
    if (point) point.expenseRupiah += event.amountRupiah;
  }

  const series = [...points.values()];
  const totalIncomeRupiah = series.reduce((sum, point) => sum + point.incomeRupiah, 0);
  const totalExpenseRupiah = series.reduce((sum, point) => sum + point.expenseRupiah, 0);
  return {
    days,
    from: range.from,
    to: range.to,
    totalIncomeRupiah,
    totalExpenseRupiah,
    netCashflowRupiah: totalIncomeRupiah - totalExpenseRupiah,
    points: series,
  };
}
