import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { CrateReturnForm } from "./crate-return-form";

const refresh = vi.fn();
const push = vi.fn();
const recordCrateReturnAction = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/app/actions/f3", () => ({ recordCrateReturnAction: (...args: unknown[]) => recordCrateReturnAction(...args) }));

const customerId = "11111111-1111-4111-8111-111111111111";
const accounts = [{ customerId, customerName: "Budi", balanceMilli: 4000 }];
const quantity = () => screen.getByLabelText(/Jumlah peti kembali/) as HTMLInputElement;

describe("CrateReturnForm", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("menolak pengembalian melebihi saldo dan mempertahankan input", () => {
    render(<CrateReturnForm accounts={accounts} fixedCustomerId={customerId}/>);
    fireEvent.change(quantity(), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Catat peti kembali" }));
    expect(recordCrateReturnAction).not.toHaveBeenCalled();
    expect(screen.getByText("Pengembalian melebihi saldo peti pelanggan (4 peti).")).toBeInTheDocument();
    expect(quantity().value).toBe("5");
  });

  it("menyimpan pengembalian yang sah dan melaporkan hasilnya", async () => {
    recordCrateReturnAction.mockResolvedValue({ ok: true, data: { crateQuantityMilli: 4000 } });
    render(<CrateReturnForm accounts={accounts} fixedCustomerId={customerId}/>);
    fireEvent.change(quantity(), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Catat peti kembali" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(recordCrateReturnAction.mock.calls[0][0]).toMatchObject({ customerId, crateQuantity: "4" });
    expect(screen.getByText("Peti kembali 4 peti dari Budi tersimpan.")).toBeInTheDocument();
    expect(quantity().value).toBe("");
  });

  it("menawarkan pilihan pelanggan ketika pelanggan tidak dikunci", () => {
    render(<CrateReturnForm accounts={[...accounts, { customerId: "22222222-2222-4222-8222-222222222222", customerName: "Siti", balanceMilli: 1000 }]}/>);
    const select = screen.getByLabelText(/Pelanggan/) as HTMLSelectElement;
    expect(select.value).toBe(customerId);
    fireEvent.change(select, { target: { value: "22222222-2222-4222-8222-222222222222" } });
    expect(screen.getByText(/Saldo Siti saat ini 1 peti\./)).toBeInTheDocument();
  });
});
