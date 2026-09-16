import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import type { CustomerRecord } from "@/domain/sales";
import { CustomerForm } from "./customer-form";
const push = vi.fn(); const refresh = vi.fn(); const create = vi.fn(); const update = vi.fn(); const archive = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/app/actions/f2", () => ({ createCustomerAction: (...args: unknown[]) => create(...args), updateCustomerAction: (...args: unknown[]) => update(...args), archiveCustomerAction: (...args: unknown[]) => archive(...args) }));
const customer: CustomerRecord = { id: "11111111-1111-4111-8111-111111111111", customerNumber: "CUS-1", name: "Budi", whatsapp: null, address: null, notes: null, isActive: true };
describe("CustomerForm", () => {
  beforeEach(() => vi.clearAllMocks());
  it("membuat pelanggan dan menampilkan validasi server", async () => { create.mockResolvedValueOnce({ ok: false, error: { code: "validation", message: "Periksa data", fields: { name: ["Nama wajib diisi"] } } }); const { unmount } = render(<CustomerForm/>); fireEvent.click(screen.getByRole("button", { name: "Tambah pelanggan" })); expect(await screen.findByText("Nama wajib diisi")).toBeInTheDocument(); unmount(); create.mockResolvedValueOnce({ ok: true, data: customer }); render(<CustomerForm/>); fireEvent.change(screen.getByLabelText("Nama pelanggan *"), { target: { value: "Budi" } }); fireEvent.click(screen.getByRole("button", { name: "Tambah pelanggan" })); await waitFor(() => expect(push).toHaveBeenCalledWith(`/pelanggan/${customer.id}`)); });
  it("mengubah dan menonaktifkan pelanggan dengan konfirmasi", async () => { update.mockResolvedValue({ ok: true, data: customer }); archive.mockResolvedValue({ ok: true, data: { ...customer, isActive: false } }); vi.spyOn(window, "confirm").mockReturnValue(true); render(<CustomerForm customer={customer}/>); fireEvent.change(screen.getByLabelText("Nama pelanggan *"), { target: { value: "Budi Baru" } }); fireEvent.click(screen.getByRole("button", { name: "Simpan perubahan" })); await screen.findByText("Perubahan pelanggan tersimpan."); fireEvent.click(screen.getByRole("button", { name: "Nonaktifkan pelanggan" })); await screen.findByText(/Pelanggan dinonaktifkan/); expect(archive).toHaveBeenCalledTimes(1); });
});
