import { describe, expect, it } from "vitest";
import type {
  CrateOutstandingRecord,
  ReceivableRecord,
  ReportExpenseEvent,
  ReportPaymentEvent,
  ReportSaleEvent,
  UndeliveredRecord,
} from "@/domain/reports";
import type { OwnerProfile } from "@/lib/auth/owner";
import { RepositoryUnavailableError } from "@/server/errors";
import type { F5Repository } from "./repository";
import { F5Service } from "./service";

const owner: OwnerProfile = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  email: "owner@example.com",
  display_name: "Owner",
};

class FakeRepository implements F5Repository {
  sales: ReportSaleEvent[] = [];
  payments: ReportPaymentEvent[] = [];
  expenses: ReportExpenseEvent[] = [];
  receivables: ReceivableRecord[] = [];
  undelivered: UndeliveredRecord[] = [];
  crates: CrateOutstandingRecord[] = [];
  fail = false;
  ranges: Array<{ from: Date; to: Date }> = [];

  private check() {
    if (this.fail) throw new RepositoryUnavailableError();
  }

  async listSales(from: Date, to: Date) {
    this.ranges.push({ from, to });
    this.check();
    return this.sales;
  }

  async listPayments(from: Date, to: Date) {
    this.ranges.push({ from, to });
    this.check();
    return this.payments;
  }

  async listExpenses(from: Date, to: Date) {
    this.ranges.push({ from, to });
    this.check();
    return this.expenses;
  }

  async listReceivables() {
    this.check();
    return this.receivables;
  }

  async listUndelivered() {
    this.check();
    return this.undelivered;
  }

  async listCrateOutstanding() {
    this.check();
    return this.crates;
  }
}

describe("F5Service", () => {
  const now = () => new Date("2026-09-17T10:00:00+07:00");

  it("menolak dashboard tanpa owner", async () => {
    const result = await new F5Service(new FakeRepository(), now).getDashboardOverview({ days: 7 }, null);
    expect(result).toMatchObject({ ok: false, error: { code: "unauthorized" } });
  });

  it("membangun metrik dan tindakan dashboard dari sumber yang tepat", async () => {
    const repository = new FakeRepository();
    repository.sales = [{ id: "sale-1", reference: "INV-001", customerName: "Budi", amountRupiah: 1_500_000, occurredAt: "2026-09-16T02:00:00.000Z" }];
    repository.payments = [{ reference: "PAY-001", invoiceNumber: "INV-001", customerName: "Budi", amountRupiah: 1_000_000, occurredAt: "2026-09-16T02:00:00.000Z" }];
    repository.expenses = [{ reference: "EXP-001", category: "egg_purchase", notes: null, amountRupiah: 250_000, occurredAt: "2026-09-16T03:00:00.000Z" }];
    repository.receivables = [{ saleId: "sale-1", invoiceNumber: "INV-001", customerName: "Budi", dueDate: "2026-09-16", outstandingRupiah: 500_000 }];
    repository.undelivered = [{ saleId: "sale-1", invoiceNumber: "INV-001", customerName: "Budi", outstandingCrateMilli: 4_000 }];
    const result = await new F5Service(repository, now).getDashboardOverview({ days: "7" }, owner);

    expect(result).toMatchObject({
      ok: true,
      data: {
        days: 7,
        totalSalesRupiah: 1_500_000,
        totalIncomeRupiah: 1_000_000,
        totalExpenseRupiah: 250_000,
        netCashflowRupiah: 750_000,
        totalReceivablesRupiah: 500_000,
        estimatedNetProfitRupiah: 1_250_000,
        comparison: { incomePercent: 0, expensePercent: 0, netCashflowPercent: 0, salesPercent: 0, profitPercent: 0 },
        expenseBreakdown: [{ category: "egg_purchase", amountRupiah: 250_000, share: 1 }],
        actionCounts: { overdue: 1, due: 0, delivery: 1, crate: 0 },
      },
    });
    expect(repository.ranges).toHaveLength(6);
    expect(repository.ranges[0]).toEqual(repository.ranges[1]);
    expect(repository.ranges[1]).toEqual(repository.ranges[2]);
    expect(repository.ranges[3].to.getTime()).toBeLessThan(repository.ranges[0].from.getTime());
    expect(repository.ranges[3]).toEqual(repository.ranges[4]);
    expect(repository.ranges[4]).toEqual(repository.ranges[5]);
  });

  it("membangun laporan periode dan default bulan berjalan", async () => {
    const repository = new FakeRepository();
    repository.sales = [{ id: "sale-1", reference: "INV-001", customerName: "Budi", amountRupiah: 1_500_000, occurredAt: "2026-09-16T02:00:00.000Z" }];
    const result = await new F5Service(repository, now).getPeriodReport({}, owner);
    expect(result).toMatchObject({ ok: true, data: { from: "2026-09-01", to: "2026-09-17", totalSalesRupiah: 1_500_000 } });
    expect(repository.ranges[0].from.toISOString()).toBe("2026-08-31T17:00:00.000Z");
  });

  it("mengembalikan retryable ketika database gagal", async () => {
    const repository = new FakeRepository();
    repository.fail = true;
    const result = await new F5Service(repository, now).getDashboardOverview({ days: 30 }, owner);
    expect(result).toMatchObject({ ok: false, error: { code: "retryable" } });
  });
});
