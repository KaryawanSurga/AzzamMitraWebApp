import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CashflowPoint } from "@/domain/reports";
import { CashflowBars, DeltaBadge, ExpenseDonut, Sparkline } from "./dashboard-charts";

const point = (date: string, incomeRupiah: number, expenseRupiah: number, salesRupiah = incomeRupiah): CashflowPoint => ({ date, incomeRupiah, expenseRupiah, salesRupiah });

describe("dashboard charts", () => {
  it("merender satu grup batang per hari dengan label tanggal", () => {
    const { container } = render(<CashflowBars points={[point("2026-09-16", 1_000_000, 250_000), point("2026-09-17", 500_000, 0)]}/>);
    expect(container.querySelectorAll(".chart-bar-group")).toHaveLength(2);
    expect(container.querySelectorAll(".chart-bar.income")).toHaveLength(2);
    expect(screen.getByText("16/9")).toBeInTheDocument();
  });

  it("mengelompokkan periode panjang menjadi batang mingguan", () => {
    const points = Array.from({ length: 30 }, (_, index) => point(`2026-09-${String(index + 1).padStart(2, "0")}`, 100_000, 10_000));
    const { container } = render(<CashflowBars points={points}/>);
    expect(container.querySelectorAll(".chart-bar-group")).toHaveLength(5);
    expect(container.querySelectorAll(".chart-bar")).toHaveLength(10);
  });

  it("menampilkan donut dengan legenda kategori dan persentase", () => {
    render(<ExpenseDonut items={[
      { category: "egg_purchase", amountRupiah: 850_000, share: 0.85 },
      { category: "delivery", amountRupiah: 150_000, share: 0.15 },
    ]}/>);
    expect(screen.getByText("Pembelian telur")).toBeInTheDocument();
    expect(screen.getByText("Transportasi / pengiriman")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("15%")).toBeInTheDocument();
  });

  it("menampilkan keadaan kosong donut tanpa pengeluaran", () => {
    render(<ExpenseDonut items={[]}/>);
    expect(screen.getByText(/Belum ada pengeluaran/)).toBeInTheDocument();
  });

  it("menandai delta sesuai arah dan konteks baik atau buruk", () => {
    const { rerender } = render(<DeltaBadge value={12.34} positiveIsGood/>);
    expect(screen.getByText("↑ 12,3%")).toBeInTheDocument();
    rerender(<DeltaBadge value={-5} positiveIsGood={false}/>);
    expect(screen.getByText("↓ 5,0%")).toBeInTheDocument();
    rerender(<DeltaBadge value={null} positiveIsGood/>);
    expect(screen.getByText("Baru")).toBeInTheDocument();
  });

  it("menggambar sparkline dari seri angka", () => {
    const { container } = render(<Sparkline points={[1, 3, 2]} tone="#24462c"/>);
    expect(container.querySelector("svg path")).toBeTruthy();
  });
});
