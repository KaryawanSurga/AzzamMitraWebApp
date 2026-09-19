import { describe, expect, it } from "vitest";
import {
  aggregateDashboardCashflow,
  buildDashboardActions,
  buildDashboardComparison,
  buildExpenseBreakdown,
  buildPeriodReport,
  dashboardDateRange,
  dashboardQuerySchema,
  percentChange,
  periodReportCsv,
  reportDateRange,
  reportQuerySchema,
} from "./reports";

describe("dashboard reporting domain", () => {
  const now = new Date("2026-09-17T10:00:00+07:00");

  it("menerima periode resmi dan menolak periode arbitrer", () => {
    expect(dashboardQuerySchema.parse({ days: "7" })).toEqual({ days: 7 });
    expect(dashboardQuerySchema.parse({})).toEqual({ days: 30 });
    expect(dashboardQuerySchema.safeParse({ days: "14" }).success).toBe(false);
  });

  it("membangun rentang dashboard inklusif menurut zona Asia Jakarta", () => {
    const range = dashboardDateRange(7, now);
    expect(range.from).toBe("2026-09-11");
    expect(range.to).toBe("2026-09-17");
    expect(range.fromDate.toISOString()).toBe("2026-09-10T17:00:00.000Z");
    expect(range.toDate.toISOString()).toBe("2026-09-17T16:59:59.999Z");
  });

  it("mengagregasi penjualan, uang masuk, dan pengeluaran per hari tanpa modal", () => {
    const result = aggregateDashboardCashflow(
      7,
      [{ amountRupiah: 1_500_000, occurredAt: "2026-09-16T01:00:00.000Z" }],
      [
        { amountRupiah: 400_000, occurredAt: "2026-09-16T02:00:00.000Z" },
        { amountRupiah: 600_000, occurredAt: "2026-09-16T08:00:00.000Z" },
      ],
      [
        { amountRupiah: 150_000, occurredAt: "2026-09-16T04:00:00.000Z" },
        { amountRupiah: 100_000, occurredAt: "2026-09-17T01:00:00.000Z" },
      ],
      now,
    );

    expect(result.points).toHaveLength(7);
    expect(result.points.find(({ date }) => date === "2026-09-16")).toMatchObject({
      incomeRupiah: 1_000_000,
      expenseRupiah: 150_000,
      salesRupiah: 1_500_000,
    });
    expect(result.totalIncomeRupiah).toBe(1_000_000);
    expect(result.totalExpenseRupiah).toBe(250_000);
    expect(result.netCashflowRupiah).toBe(750_000);
  });

  it("menghitung persentase perubahan periode sebelumnya", () => {
    expect(percentChange(150, 100)).toBeCloseTo(50);
    expect(percentChange(50, 100)).toBeCloseTo(-50);
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(100, 0)).toBeNull();

    const comparison = buildDashboardComparison(
      { incomeRupiah: 1_500_000, expenseRupiah: 500_000, salesRupiah: 2_000_000 },
      { incomeRupiah: 1_000_000, expenseRupiah: 400_000, salesRupiah: 1_600_000 },
    );
    expect(comparison).toMatchObject({ incomePercent: 50, expensePercent: 25, salesPercent: 25, profitPercent: 25 });
    expect(comparison.netCashflowPercent).toBeCloseTo(66.67);
  });

  it("menyusun rincian pengeluaran per kategori berurut nominal", () => {
    const breakdown = buildExpenseBreakdown([
      { reference: "EXP-1", category: "egg_purchase", notes: null, amountRupiah: 600_000, occurredAt: "2026-09-16T04:00:00Z" },
      { reference: "EXP-2", category: "delivery", notes: null, amountRupiah: 150_000, occurredAt: "2026-09-16T05:00:00Z" },
      { reference: "EXP-3", category: "egg_purchase", notes: null, amountRupiah: 250_000, occurredAt: "2026-09-17T05:00:00Z" },
    ]);
    expect(breakdown).toEqual([
      { category: "egg_purchase", amountRupiah: 850_000, share: 0.85 },
      { category: "delivery", amountRupiah: 150_000, share: 0.15 },
    ]);
  });
});

describe("period report domain", () => {
  const now = new Date("2026-09-17T10:00:00+07:00");

  it("memakai bulan berjalan sebagai rentang bawaan dan memvalidasi urutan tanggal", () => {
    expect(reportDateRange({}, now)).toMatchObject({ from: "2026-09-01", to: "2026-09-17" });
    expect(reportQuerySchema.safeParse({ from: "2026-09-17", to: "2026-09-01" }).success).toBe(false);
    expect(reportQuerySchema.safeParse({ from: "2026-02-30", to: "2026-09-01" }).success).toBe(false);
  });

  it("menghitung semua metrik dari sumber yang tepat", () => {
    const report = buildPeriodReport(
      { from: "2026-09-01", to: "2026-09-17" },
      [{ id: "sale-1", reference: "INV-001", customerName: "Budi", amountRupiah: 1_500_000, occurredAt: "2026-09-16T02:00:00Z" }],
      [{ reference: "PAY-001", invoiceNumber: "INV-001", customerName: "Budi", amountRupiah: 1_000_000, occurredAt: "2026-09-16T03:00:00Z" }],
      [{ reference: "EXP-001", category: "egg_purchase", notes: "Belanja kandang", amountRupiah: 400_000, occurredAt: "2026-09-16T04:00:00Z" }],
      [{ saleId: "sale-1", invoiceNumber: "INV-001", customerName: "Budi", dueDate: "2026-09-17", outstandingRupiah: 500_000 }],
    );

    expect(report).toMatchObject({
      totalSalesRupiah: 1_500_000,
      totalIncomeRupiah: 1_000_000,
      totalExpenseRupiah: 400_000,
      netCashflowRupiah: 600_000,
      totalReceivablesRupiah: 500_000,
      otherIncomeRupiah: 0,
      estimatedNetProfitRupiah: 1_100_000,
    });
    expect(report.rows).toHaveLength(3);
    expect(report.rows.find(({ type }) => type === "expense")?.description).toContain("Pembelian telur");
  });

  it("memisahkan tindakan terlambat, jatuh tempo, pengiriman, dan peti", () => {
    const result = buildDashboardActions(
      [
        { saleId: "sale-1", invoiceNumber: "INV-001", customerName: "Budi", dueDate: "2026-09-16", outstandingRupiah: 500_000 },
        { saleId: "sale-2", invoiceNumber: "INV-002", customerName: "Tania", dueDate: "2026-09-17", outstandingRupiah: 250_000 },
      ],
      [{ saleId: "sale-1", invoiceNumber: "INV-001", customerName: "Budi", outstandingCrateMilli: 4_000 }],
      [{ customerId: "customer-1", customerName: "Budi", balanceMilli: 3_000 }],
      "2026-09-17",
    );

    expect(result.actionCounts).toEqual({ overdue: 1, due: 1, delivery: 1, crate: 1 });
    expect(result.actions.map(({ kind }) => kind)).toEqual(["overdue", "due", "delivery", "crate"]);
  });

  it("menghasilkan CSV dengan ringkasan dan rincian dari laporan yang sama", () => {
    const report = buildPeriodReport(
      { from: "2026-09-01", to: "2026-09-17" },
      [{ id: "sale-1", reference: "INV-001", customerName: "Budi, Sentosa", amountRupiah: 1_500_000, occurredAt: "2026-09-16T02:00:00Z" }],
      [],
      [],
      [],
    );
    const csv = periodReportCsv(report);
    expect(csv).toContain('"Penjualan bersih","1500000"');
    expect(csv).toContain('"Budi, Sentosa"');
    expect(csv).toContain('"Estimasi laba bersih","1500000"');
  });
});
