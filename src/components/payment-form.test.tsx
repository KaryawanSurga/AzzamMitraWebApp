import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { PaymentForm } from "./payment-form";

const refresh = vi.fn();
const push = vi.fn();
const createPaymentAction = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/app/actions/f3", () => ({ createPaymentAction: (...args: unknown[]) => createPaymentAction(...args) }));

const saleId = "11111111-1111-4111-8111-111111111111";
const amount = () => screen.getByLabelText(/Nominal \(Rp\)/) as HTMLInputElement;

describe("PaymentForm", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("menolak nominal melebihi sisa piutang tanpa menghubungi server", () => {
    render(<PaymentForm saleId={saleId} remainingRupiah={500_000}/>);
    fireEvent.change(amount(), { target: { value: "600000" } });
    fireEvent.click(screen.getByRole("button", { name: "Catat pembayaran" }));
    expect(createPaymentAction).not.toHaveBeenCalled();
    expect(screen.getByText("Nominal pembayaran melebihi sisa piutang.")).toBeInTheDocument();
  });

  it("mencegah submit ganda dan menyimpan pembayaran yang sah", async () => {
    const gate = Promise.withResolvers<{ ok: true; data: { id: string; amountRupiah: number } }>();
    createPaymentAction.mockReturnValue(gate.promise);
    render(<PaymentForm saleId={saleId} remainingRupiah={500_000}/>);
    fireEvent.change(amount(), { target: { value: "200000" } });
    const button = screen.getByRole("button", { name: "Catat pembayaran" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(createPaymentAction).toHaveBeenCalledTimes(1);
    expect(createPaymentAction.mock.calls[0][0]).toMatchObject({ saleId, amountRupiah: 200_000, method: "cash" });
    gate.resolve({ ok: true, data: { id: "payment-1", amountRupiah: 200_000 } });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.getByText(/Pembayaran .* tersimpan\./)).toBeInTheDocument();
    expect(amount().value).toBe("");
  });

  it("menjaga input dan menampilkan pesan ketika server menolak", async () => {
    createPaymentAction.mockResolvedValue({ ok: false, error: { code: "validation", message: "Periksa kembali data yang diisi.", fields: { amountRupiah: ["Nominal pembayaran melebihi sisa piutang."] } } });
    render(<PaymentForm saleId={saleId} remainingRupiah={500_000}/>);
    fireEvent.change(amount(), { target: { value: "100000" } });
    fireEvent.click(screen.getByRole("button", { name: "Catat pembayaran" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Periksa kembali data yang diisi."));
    expect(amount().value).toBe("100000");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("mengunci formulir ketika invoice sudah lunas", () => {
    render(<PaymentForm saleId={saleId} remainingRupiah={0}/>);
    expect(screen.getByText("Invoice ini sudah lunas.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Catat pembayaran" })).not.toBeInTheDocument();
  });
});
