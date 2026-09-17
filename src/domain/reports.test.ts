import { describe, expect, it } from "vitest";
import { aggregateDashboardCashflow, dashboardDateRange, dashboardQuerySchema } from "./reports";

describe("dashboard reporting domain", () => {
  const now = new Date("2026-09-17T10:00:00+07:00");

  it("menerima periode resmi dan menolak periode arbitrer", () => {
    expect(dashboardQuerySchema.parse({ days: "7" })).toEqual({ days: 7 });
    expect(dashboardQuerySchema.parse({})).toEqual({ days: 30 });
    expect(dashboardQuerySchema.safeParse({ days: "14" }).success).toBe(false);
  });

  it("membangun rentang inklusif menurut zona Asia Jakarta", () => {
    const range = dashboardDateRange(7, now);
    expect(range.from).toBe("2026-09-11");
    expect(range.to).toBe("2026-09-17");
    expect(range.fromDate.toISOString()).toBe("2026-09-10T17:00:00.000Z");
    expect(range.toDate.toISOString()).toBe("2026-09-17T16:59:59.999Z");
  });

  it("mengagregasi uang masuk dan pengeluaran per hari tanpa modal", () => {
    const result = aggregateDashboardCashflow(
      7,
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
    });
    expect(result.totalIncomeRupiah).toBe(1_000_000);
    expect(result.totalExpenseRupiah).toBe(250_000);
    expect(result.netCashflowRupiah).toBe(750_000);
  });
});
