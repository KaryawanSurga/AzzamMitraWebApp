import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { ExpenseForm } from "./expense-form";
import { CapitalMovementForm } from "./capital-movement-form";

const push = vi.fn();
const refresh = vi.fn();
const createExpenseAction = vi.fn();
const createCapitalMovementAction = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/app/actions/f4", () => ({
  createExpenseAction: (...args: unknown[]) => createExpenseAction(...args),
  createCapitalMovementAction: (...args: unknown[]) => createCapitalMovementAction(...args),
}));

describe("ExpenseForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menolak nominal kosong tanpa menghubungi server", () => {
    render(<ExpenseForm/>);
    fireEvent.click(screen.getByRole("button", { name: "Simpan pengeluaran" }));
    expect(createExpenseAction).not.toHaveBeenCalled();
    expect(screen.getByText("Nominal harus lebih dari nol.")).toBeInTheDocument();
  });

  it("mencegah submit ganda dan mengirim data pengeluaran terstruktur", async () => {
    const gate = Promise.withResolvers<{
      ok: true;
      data: {
        id: string;
        expenseNumber: string;
        category: "delivery";
        amountRupiah: number;
        method: "cash";
        occurredAt: string;
        notes: string;
      };
    }>();
    createExpenseAction.mockReturnValue(gate.promise);
    render(<ExpenseForm/>);

    fireEvent.change(screen.getByLabelText(/Kategori/), { target: { value: "delivery" } });
    fireEvent.change(screen.getByLabelText(/Nominal \(Rp\)/), { target: { value: "150000" } });
    fireEvent.change(screen.getByLabelText(/Metode pembayaran/), { target: { value: "cash" } });
    fireEvent.change(screen.getByLabelText(/Waktu transaksi/), { target: { value: "2026-09-16T08:30" } });
    fireEvent.change(screen.getByLabelText("Catatan"), { target: { value: "Kirim telur" } });

    const button = screen.getByRole("button", { name: "Simpan pengeluaran" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(createExpenseAction).toHaveBeenCalledTimes(1);
    expect(createExpenseAction.mock.calls[0][0]).toMatchObject({
      category: "delivery",
      amountRupiah: 150_000,
      method: "cash",
      occurredAt: "2026-09-16T08:30:00+07:00",
      notes: "Kirim telur",
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });

    gate.resolve({
      ok: true,
      data: {
        id: crypto.randomUUID(),
        expenseNumber: "EXP-1",
        category: "delivery",
        amountRupiah: 150_000,
        method: "cash",
        occurredAt: "2026-09-16T01:30:00.000Z",
        notes: "Kirim telur",
      },
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/pengeluaran?created=1"));
  });

  it("mempertahankan input ketika server gagal", async () => {
    createExpenseAction.mockRejectedValue(new Error("offline"));
    render(<ExpenseForm/>);
    const amount = screen.getByLabelText(/Nominal \(Rp\)/) as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "75000" } });
    fireEvent.change(screen.getByLabelText(/Waktu transaksi/), { target: { value: "2026-09-16T08:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan pengeluaran" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Periksa koneksi"));
    expect(amount.value).toBe("75000");
    expect(push).not.toHaveBeenCalled();
  });
});

describe("CapitalMovementForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mencatat prive terpisah dan membersihkan nominal setelah berhasil", async () => {
    createCapitalMovementAction.mockResolvedValue({
      ok: true,
      data: {
        id: crypto.randomUUID(),
        movementNumber: "CAP-1",
        type: "owner_draw",
        amountRupiah: 250_000,
        occurredAt: "2026-09-16T01:30:00.000Z",
        notes: "Kebutuhan pribadi",
      },
    });
    render(<CapitalMovementForm/>);

    fireEvent.click(screen.getByLabelText("Prive / pengambilan pribadi"));
    const amount = screen.getByLabelText(/Nominal \(Rp\)/) as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "250000" } });
    fireEvent.change(screen.getByLabelText(/Waktu transaksi/), { target: { value: "2026-09-16T08:30" } });
    fireEvent.change(screen.getByLabelText("Catatan"), { target: { value: "Kebutuhan pribadi" } });
    fireEvent.click(screen.getByRole("button", { name: "Catat modal / prive" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(createCapitalMovementAction.mock.calls[0][0]).toMatchObject({
      type: "owner_draw",
      amountRupiah: 250_000,
      notes: "Kebutuhan pribadi",
    });
    expect(screen.getByRole("status")).toHaveTextContent("Prive / pengambilan pribadi");
    expect(amount.value).toBe("");
  });
});
