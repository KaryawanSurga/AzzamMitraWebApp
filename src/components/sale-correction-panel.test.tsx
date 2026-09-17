import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { SaleCorrectionPanel } from "./sale-correction-panel";

const refresh = vi.fn();
const cancelSaleAction = vi.fn();
const correctSaleAction = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/actions/f2", () => ({
  cancelSaleAction: (...args: unknown[]) => cancelSaleAction(...args),
  correctSaleAction: (...args: unknown[]) => correctSaleAction(...args),
}));

const sale = {
  id: "11111111-1111-4111-8111-111111111111",
  invoiceNumber: "INV-100",
  subtotalRupiah: 2_000_000,
  discountRupiah: 0,
  feeRupiah: 0,
  totalRupiah: 2_000_000,
  paidRupiah: 500_000,
  dueDate: "2026-10-01",
  notes: null,
};

describe("SaleCorrectionPanel", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("menampilkan pratinjau total saat koreksi diisi", () => {
    render(<SaleCorrectionPanel sale={sale}/>);
    fireEvent.click(screen.getByRole("button", { name: "Koreksi invoice" }));
    fireEvent.change(screen.getByLabelText(/Diskon \(Rp\)/), { target: { value: "200000" } });
    expect(screen.getByText(/Total setelah koreksi:/)).toHaveTextContent("Rp 1.800.000");
  });

  it("menolak alasan koreksi yang terlalu pendek tanpa menghubungi server", () => {
    render(<SaleCorrectionPanel sale={sale}/>);
    fireEvent.click(screen.getByRole("button", { name: "Koreksi invoice" }));
    fireEvent.click(screen.getByRole("button", { name: "Simpan koreksi" }));
    expect(correctSaleAction).not.toHaveBeenCalled();
    expect(screen.getByText("Alasan koreksi minimal 10 karakter.")).toBeInTheDocument();
  });

  it("mengirim koreksi dengan nilai saat ini dan refresh setelah sukses", async () => {
    correctSaleAction.mockResolvedValue({ ok: true, data: { id: sale.id, totalRupiah: 2_000_000 } });
    render(<SaleCorrectionPanel sale={sale}/>);
    fireEvent.click(screen.getByRole("button", { name: "Koreksi invoice" }));
    fireEvent.change(screen.getByLabelText(/Alasan koreksi/), { target: { value: "Koreksi jatuh tempo pelanggan" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan koreksi" }));
    await waitFor(() => expect(correctSaleAction).toHaveBeenCalledTimes(1));
    expect(correctSaleAction.mock.calls[0][0]).toMatchObject({ saleId: sale.id, discountRupiah: 0, feeRupiah: 0, dueDate: "2026-10-01", reason: "Koreksi jatuh tempo pelanggan" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("mewajibkan konfirmasi dampak sebelum pembatalan dikirim", async () => {
    cancelSaleAction.mockResolvedValue({ ok: true, data: { id: sale.id, status: "cancelled" } });
    render(<SaleCorrectionPanel sale={sale}/>);
    fireEvent.click(screen.getByRole("button", { name: "Batalkan invoice" }));
    fireEvent.change(screen.getByLabelText(/Alasan pembatalan/), { target: { value: "Pelanggan membatalkan pesanan" } });
    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi pembatalan" }));
    expect(cancelSaleAction).not.toHaveBeenCalled();
    expect(screen.getByText("Konfirmasi dampak pembatalan wajib dicentang.")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Saya memahami dampak pembatalan/));
    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi pembatalan" }));
    await waitFor(() => expect(cancelSaleAction).toHaveBeenCalledTimes(1));
    expect(cancelSaleAction.mock.calls[0][0]).toMatchObject({ saleId: sale.id, reason: "Pelanggan membatalkan pesanan" });
  });

  it("menampilkan pesan server dan mempertahankan input", async () => {
    cancelSaleAction.mockResolvedValue({ ok: false, error: { code: "conflict", message: "Invoice ini sudah dibatalkan." } });
    render(<SaleCorrectionPanel sale={sale}/>);
    fireEvent.click(screen.getByRole("button", { name: "Batalkan invoice" }));
    const reason = screen.getByLabelText(/Alasan pembatalan/) as HTMLTextAreaElement;
    fireEvent.change(reason, { target: { value: "Pelanggan membatalkan pesanan" } });
    fireEvent.click(screen.getByLabelText(/Saya memahami dampak pembatalan/));
    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi pembatalan" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Invoice ini sudah dibatalkan."));
    expect(reason.value).toBe("Pelanggan membatalkan pesanan");
    expect(refresh).not.toHaveBeenCalled();
  });
});
