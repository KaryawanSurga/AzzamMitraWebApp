import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CashflowChart } from "./cashflow-chart";

const points = [
  { date: "2026-09-16", incomeRupiah: 1_000_000, expenseRupiah: 150_000 },
  { date: "2026-09-17", incomeRupiah: 500_000, expenseRupiah: 200_000 },
];

describe("CashflowChart", () => {
  it("menyediakan diagram, legenda, dan tabel data aksesibel", () => {
    render(<CashflowChart points={points}/>);
    expect(screen.getByRole("img", { name: "Diagram uang masuk dan pengeluaran harian" })).toBeInTheDocument();
    expect(screen.getByLabelText("Legenda diagram")).toHaveTextContent("Uang masukPengeluaran");
    expect(screen.getByRole("table", { name: "Data uang masuk dan pengeluaran harian" })).toHaveTextContent("Rp 1.000.000");
  });

  it("menjelaskan periode tanpa aktivitas", () => {
    render(<CashflowChart points={points.map((point) => ({ ...point, incomeRupiah: 0, expenseRupiah: 0 }))}/>);
    expect(screen.getByText("Belum ada pembayaran atau pengeluaran pada periode ini.")).toBeInTheDocument();
  });
});
