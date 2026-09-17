import { describe, expect, it } from "vitest";
import type { CashflowEvent } from "@/domain/reports";
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
  income: CashflowEvent[] = [];
  expenses: CashflowEvent[] = [];
  fail = false;
  ranges: Array<{ from: Date; to: Date }> = [];

  async listIncomeEvents(from: Date, to: Date) {
    this.ranges.push({ from, to });
    if (this.fail) throw new RepositoryUnavailableError();
    return this.income;
  }

  async listExpenseEvents(from: Date, to: Date) {
    this.ranges.push({ from, to });
    if (this.fail) throw new RepositoryUnavailableError();
    return this.expenses;
  }
}

describe("F5Service", () => {
  const now = () => new Date("2026-09-17T10:00:00+07:00");

  it("menolak dashboard tanpa owner", async () => {
    const result = await new F5Service(new FakeRepository(), now).getDashboardCashflow({ days: 7 }, null);
    expect(result).toMatchObject({ ok: false, error: { code: "unauthorized" } });
  });

  it("mengambil pembayaran dan pengeluaran pada rentang yang sama", async () => {
    const repository = new FakeRepository();
    repository.income = [{ amountRupiah: 1_000_000, occurredAt: "2026-09-16T02:00:00.000Z" }];
    repository.expenses = [{ amountRupiah: 250_000, occurredAt: "2026-09-16T03:00:00.000Z" }];
    const result = await new F5Service(repository, now).getDashboardCashflow({ days: "7" }, owner);

    expect(result).toMatchObject({
      ok: true,
      data: {
        days: 7,
        totalIncomeRupiah: 1_000_000,
        totalExpenseRupiah: 250_000,
        netCashflowRupiah: 750_000,
      },
    });
    expect(repository.ranges).toHaveLength(2);
    expect(repository.ranges[0]).toEqual(repository.ranges[1]);
  });

  it("mengembalikan retryable ketika database gagal", async () => {
    const repository = new FakeRepository();
    repository.fail = true;
    const result = await new F5Service(repository, now).getDashboardCashflow({ days: 30 }, owner);
    expect(result).toMatchObject({ ok: false, error: { code: "retryable" } });
  });
});
