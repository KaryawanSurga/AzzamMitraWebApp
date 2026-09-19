import { z } from "zod";
import { dateSchema } from "./contracts";
import { expenseCategoryLabels, type ExpenseCategory, jakartaDateTimeLocal } from "./finance";

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

export const reportQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
}).refine(
  ({ from, to }) => !from || !to || from <= to,
  { path: ["to"], message: "Batas akhir periode tidak boleh sebelum batas awal." },
);

export type CashflowEvent = {
  amountRupiah: number;
  occurredAt: string;
};

export type ReportSaleEvent = CashflowEvent & {
  id: string;
  reference: string;
  customerName: string;
};

export type ReportPaymentEvent = CashflowEvent & {
  reference: string;
  invoiceNumber: string;
  customerName: string;
};

export type ReportExpenseEvent = CashflowEvent & {
  reference: string;
  category: ExpenseCategory;
  notes: string | null;
};

export type ReceivableRecord = {
  saleId: string;
  invoiceNumber: string;
  customerName: string;
  dueDate: string | null;
  outstandingRupiah: number;
};

export type UndeliveredRecord = {
  saleId: string;
  invoiceNumber: string;
  customerName: string;
  outstandingCrateMilli: number;
};

export type CrateOutstandingRecord = {
  customerId: string;
  customerName: string;
  balanceMilli: number;
};

export type CashflowPoint = {
  date: string;
  incomeRupiah: number;
  expenseRupiah: number;
  salesRupiah: number;
};

export type PercentChange = number | null;

export type DashboardComparison = {
  incomePercent: PercentChange;
  expensePercent: PercentChange;
  netCashflowPercent: PercentChange;
  salesPercent: PercentChange;
  profitPercent: PercentChange;
};

export type ExpenseBreakdownItem = {
  category: ExpenseCategory;
  amountRupiah: number;
  share: number;
};

export type DashboardAction = {
  kind: "overdue" | "due" | "delivery" | "crate";
  href: string;
  title: string;
  detail: string;
  amountRupiah?: number;
  crateQuantityMilli?: number;
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

export type DashboardOverview = DashboardCashflow & {
  totalSalesRupiah: number;
  totalReceivablesRupiah: number;
  estimatedNetProfitRupiah: number;
  comparison: DashboardComparison;
  expenseBreakdown: ExpenseBreakdownItem[];
  actions: DashboardAction[];
  actionCounts: Record<DashboardAction["kind"], number>;
};

export type ReportRow = {
  date: string;
  type: "sale" | "payment" | "expense";
  reference: string;
  description: string;
  amountRupiah: number;
};

export type PeriodReport = {
  from: string;
  to: string;
  totalSalesRupiah: number;
  totalIncomeRupiah: number;
  totalExpenseRupiah: number;
  netCashflowRupiah: number;
  totalReceivablesRupiah: number;
  otherIncomeRupiah: number;
  estimatedNetProfitRupiah: number;
  rows: ReportRow[];
};

export function dashboardDateRange(days: DashboardPeriodDays, now = new Date()) {
  const to = jakartaDateTimeLocal(now).slice(0, 10);
  const toMidnight = new Date(`${to}T00:00:00+07:00`);
  const fromMidnight = new Date(toMidnight.getTime() - (days - 1) * 86_400_000);
  const from = jakartaDateTimeLocal(fromMidnight).slice(0, 10);
  return dateRange(from, to);
}

export function reportDateRange(input: { from?: string; to?: string }, now = new Date()) {
  const today = jakartaDateTimeLocal(now).slice(0, 10);
  return dateRange(input.from ?? `${today.slice(0, 7)}-01`, input.to ?? today);
}

function dateRange(from: string, to: string) {
  return {
    from,
    to,
    fromDate: new Date(`${from}T00:00:00+07:00`),
    toDate: new Date(`${to}T23:59:59.999+07:00`),
  };
}

export function aggregateDashboardCashflow(
  days: DashboardPeriodDays,
  salesEvents: CashflowEvent[],
  incomeEvents: CashflowEvent[],
  expenseEvents: CashflowEvent[],
  now = new Date(),
): DashboardCashflow {
  const range = dashboardDateRange(days, now);
  const points = new Map<string, CashflowPoint>();
  const start = new Date(`${range.from}T00:00:00+07:00`).getTime();

  for (let index = 0; index < days; index += 1) {
    const date = jakartaDateTimeLocal(new Date(start + index * 86_400_000)).slice(0, 10);
    points.set(date, { date, incomeRupiah: 0, expenseRupiah: 0, salesRupiah: 0 });
  }

  for (const event of salesEvents) {
    const date = jakartaDateTimeLocal(new Date(event.occurredAt)).slice(0, 10);
    const point = points.get(date);
    if (point) point.salesRupiah += event.amountRupiah;
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

export function percentChange(current: number, previous: number): PercentChange {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function buildDashboardComparison(
  current: { incomeRupiah: number; expenseRupiah: number; salesRupiah: number },
  previous: { incomeRupiah: number; expenseRupiah: number; salesRupiah: number },
): DashboardComparison {
  return {
    incomePercent: percentChange(current.incomeRupiah, previous.incomeRupiah),
    expensePercent: percentChange(current.expenseRupiah, previous.expenseRupiah),
    netCashflowPercent: percentChange(current.incomeRupiah - current.expenseRupiah, previous.incomeRupiah - previous.expenseRupiah),
    salesPercent: percentChange(current.salesRupiah, previous.salesRupiah),
    profitPercent: percentChange(current.salesRupiah - current.expenseRupiah, previous.salesRupiah - previous.expenseRupiah),
  };
}

export function buildExpenseBreakdown(expenses: ReportExpenseEvent[]): ExpenseBreakdownItem[] {
  const totals = new Map<ExpenseCategory, number>();
  for (const expense of expenses) totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amountRupiah);
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return [...totals.entries()]
    .map(([category, amountRupiah]) => ({ category, amountRupiah, share: total === 0 ? 0 : amountRupiah / total }))
    .sort((left, right) => right.amountRupiah - left.amountRupiah);
}

export function buildPeriodReport(
  range: { from: string; to: string },
  sales: ReportSaleEvent[],
  payments: ReportPaymentEvent[],
  expenses: ReportExpenseEvent[],
  receivables: ReceivableRecord[],
): PeriodReport {
  const totalSalesRupiah = sales.reduce((sum, event) => sum + event.amountRupiah, 0);
  const totalIncomeRupiah = payments.reduce((sum, event) => sum + event.amountRupiah, 0);
  const totalExpenseRupiah = expenses.reduce((sum, event) => sum + event.amountRupiah, 0);
  const totalReceivablesRupiah = receivables.reduce((sum, item) => sum + item.outstandingRupiah, 0);
  const otherIncomeRupiah = 0;
  const rows: ReportRow[] = [
    ...sales.map((event) => ({
      date: eventDate(event.occurredAt),
      type: "sale" as const,
      reference: event.reference,
      description: event.customerName,
      amountRupiah: event.amountRupiah,
    })),
    ...payments.map((event) => ({
      date: eventDate(event.occurredAt),
      type: "payment" as const,
      reference: event.reference,
      description: `${event.customerName} · ${event.invoiceNumber}`,
      amountRupiah: event.amountRupiah,
    })),
    ...expenses.map((event) => ({
      date: eventDate(event.occurredAt),
      type: "expense" as const,
      reference: event.reference,
      description: event.notes ? `${expenseCategoryLabels[event.category]} · ${event.notes}` : expenseCategoryLabels[event.category],
      amountRupiah: event.amountRupiah,
    })),
  ].sort((left, right) => right.date.localeCompare(left.date) || left.type.localeCompare(right.type));

  return {
    from: range.from,
    to: range.to,
    totalSalesRupiah,
    totalIncomeRupiah,
    totalExpenseRupiah,
    netCashflowRupiah: totalIncomeRupiah - totalExpenseRupiah,
    totalReceivablesRupiah,
    otherIncomeRupiah,
    estimatedNetProfitRupiah: totalSalesRupiah + otherIncomeRupiah - totalExpenseRupiah,
    rows,
  };
}

export function buildDashboardActions(
  receivables: ReceivableRecord[],
  undelivered: UndeliveredRecord[],
  crates: CrateOutstandingRecord[],
  today: string,
) {
  const overdue = receivables.filter((item) => item.dueDate && item.dueDate < today);
  const due = receivables.filter((item) => item.dueDate === today);
  const actions: DashboardAction[] = [
    ...overdue.map((item) => ({ kind: "overdue" as const, href: `/penjualan/${item.saleId}`, title: item.invoiceNumber, detail: `${item.customerName} · terlambat`, amountRupiah: item.outstandingRupiah })),
    ...due.map((item) => ({ kind: "due" as const, href: `/penjualan/${item.saleId}`, title: item.invoiceNumber, detail: `${item.customerName} · jatuh tempo hari ini`, amountRupiah: item.outstandingRupiah })),
    ...undelivered.map((item) => ({ kind: "delivery" as const, href: `/penjualan/${item.saleId}`, title: item.invoiceNumber, detail: `${item.customerName} · belum diterima penuh`, crateQuantityMilli: item.outstandingCrateMilli })),
    ...crates.map((item) => ({ kind: "crate" as const, href: `/peti?customerId=${item.customerId}`, title: item.customerName, detail: "Peti belum kembali", crateQuantityMilli: item.balanceMilli })),
  ];
  return {
    actions,
    actionCounts: {
      overdue: overdue.length,
      due: due.length,
      delivery: undelivered.length,
      crate: crates.length,
    },
  };
}

export function periodReportCsv(report: PeriodReport): string {
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const lines = [
    ["Laporan Azzam Mitra"],
    ["Periode", `${report.from} sampai ${report.to}`],
    [],
    ["Ringkasan", "Nominal (Rp)"],
    ["Penjualan bersih", report.totalSalesRupiah],
    ["Uang masuk", report.totalIncomeRupiah],
    ["Pengeluaran", report.totalExpenseRupiah],
    ["Arus kas bersih", report.netCashflowRupiah],
    ["Piutang per akhir periode", report.totalReceivablesRupiah],
    ["Pendapatan lain", report.otherIncomeRupiah],
    ["Estimasi laba bersih", report.estimatedNetProfitRupiah],
    [],
    ["Tanggal", "Jenis", "Nomor", "Keterangan", "Nominal (Rp)"],
    ...report.rows.map((row) => [row.date, row.type === "sale" ? "Penjualan" : row.type === "payment" ? "Uang masuk" : "Pengeluaran", row.reference, row.description, row.amountRupiah]),
  ];
  return lines.map((line) => line.map(escape).join(",")).join("\r\n");
}

function eventDate(value: string) {
  return jakartaDateTimeLocal(new Date(value)).slice(0, 10);
}
