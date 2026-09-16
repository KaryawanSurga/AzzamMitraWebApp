import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OwnerProfile } from "@/lib/auth/owner";
import { derivePaymentStatus, type SaleMutationInput } from "@/domain/sales";
import { RepositoryConflictError, RepositoryUnavailableError, type CalculatedSale, type CustomerRecord, type F2Repository, type SaleRecord } from "./repository";
import { F2Service } from "./service";

const owner: OwnerProfile = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "owner@example.com", display_name: "Owner" };
const saleInput = { customerId: "11111111-1111-4111-8111-111111111111", transactionDate: "2026-09-15", items: [{ description: "Telur", pricingBasis: "kg", crateQuantity: "10", weightKg: "103.5", unitPriceRupiah: 25000 }], discountRupiah: 0, feeRupiah: 0, paymentChoice: "down_payment", initialPaymentRupiah: 1000000, paymentMethod: "transfer", dueDate: "2026-10-15", idempotencyKey: "22222222-2222-4222-8222-222222222222", status: "confirmed" };

class FakeRepository implements F2Repository {
  customers: CustomerRecord[] = []; customerKeys = new Map<string, CustomerRecord>(); sales = new Map<string, SaleRecord>(); createSaleCalls = 0; failSale = false;
  async findCustomerByIdempotencyKey(key: string) { return this.customerKeys.get(key) ?? null; }
  async createCustomer(input: { idempotencyKey: string; name: string; whatsapp?: string; address?: string; notes?: string }): Promise<CustomerRecord> { await Promise.resolve(); if (this.customerKeys.has(input.idempotencyKey)) throw new RepositoryConflictError(); const record = { id: crypto.randomUUID(), customerNumber: `CUS-${this.customers.length + 1}`, name: input.name, whatsapp: input.whatsapp ?? null, address: input.address ?? null, notes: input.notes ?? null, isActive: true }; this.customers.push(record); this.customerKeys.set(input.idempotencyKey, record); return record; }
  async updateCustomer(input: { id: string; idempotencyKey: string; name?: string; whatsapp?: string; address?: string; notes?: string }): Promise<CustomerRecord | null> { const record = this.customers.find(({ id }) => id === input.id); if (!record) return null; Object.assign(record, input); this.customerKeys.set(input.idempotencyKey, record); return record; }
  async setCustomerActive(id: string, isActive: boolean, idempotencyKey: string): Promise<CustomerRecord | null> { const record = this.customers.find((item) => item.id === id); if (!record) return null; record.isActive = isActive; this.customerKeys.set(idempotencyKey, record); return record; }
  async listCustomers(input: { query: string; includeArchived: boolean; limit: number; offset: number }): Promise<CustomerRecord[]> { return this.customers.filter((item) => (input.includeArchived || item.isActive) && item.name.includes(input.query)).slice(input.offset, input.offset + input.limit); }
  async getCustomer(id: string): Promise<CustomerRecord | null> { return this.customers.find((item) => item.id === id) ?? null; }
  async findSaleByIdempotencyKey(key: string, today: string): Promise<SaleRecord | null> { const record = this.sales.get(key); return record ? { ...record, paymentStatus: derivePaymentStatus(record.remainingRupiah, record.paidRupiah, record.dueDate, today) } : null; }
  async createSaleAtomic(input: SaleMutationInput, calculated: CalculatedSale): Promise<SaleRecord> { this.createSaleCalls++; if (this.failSale) throw new RepositoryUnavailableError(); const record: SaleRecord = { id: crypto.randomUUID(), invoiceNumber: "INV-1", idempotencyKey: input.idempotencyKey, totalRupiah: calculated.totalRupiah, paidRupiah: calculated.paidRupiah, remainingRupiah: calculated.remainingRupiah, dueDate: input.dueDate ?? null, paymentStatus: calculated.paymentStatus, status: input.status }; this.sales.set(input.idempotencyKey, record); return record; }
  async listSales() { return []; }
  async getSale() { return null; }
}

describe("F2Service", () => {
  let repository: FakeRepository; let service: F2Service;
  beforeEach(() => { repository = new FakeRepository(); service = new F2Service(repository, () => new Date("2026-09-15T03:00:00Z")); });
  it("membuat, memperbarui, mencari, dan mengarsipkan pelanggan", async () => { const created = await service.createCustomer({ name: "Budi", idempotencyKey: crypto.randomUUID() }, owner); expect(created.ok).toBe(true); if (!created.ok) return; const updated = await service.updateCustomer({ id: created.data.id, notes: "Prioritas", idempotencyKey: crypto.randomUUID() }, owner); expect(updated).toMatchObject({ ok: true, data: { notes: "Prioritas" } }); expect(await service.getCustomer({ id: created.data.id }, owner)).toMatchObject({ ok: true, data: { name: "Budi" } }); expect(await service.listCustomers({ query: "Budi" }, owner)).toMatchObject({ ok: true, data: [{ name: "Budi" }] }); expect(await service.archiveCustomer({ id: created.data.id, idempotencyKey: crypto.randomUUID() }, owner)).toMatchObject({ ok: true, data: { isActive: false } }); });
  it("meng-idempotensikan create pelanggan", async () => { const input = { name: "Budi", idempotencyKey: crypto.randomUUID() }; const [first, second] = await Promise.all([service.createCustomer(input, owner), service.createCustomer(input, owner)]); expect(first).toEqual(second); expect(repository.customers).toHaveLength(1); });
  it("mengembalikan daftar kosong secara typed", async () => { expect(await service.listCustomers({}, owner)).toEqual({ ok: true, data: [] }); });
  it("menolak sesi kosong atau profil UUID mismatch yang direpresentasikan guard sebagai null", async () => { expect(await service.listCustomers({}, null)).toMatchObject({ ok: false, error: { code: "unauthorized" } }); expect(repository.customers).toHaveLength(0); });
  it("mengembalikan hasil deterministik untuk duplicate submit", async () => { const first = await service.createSale(saleInput, owner); const second = await service.createSale(saleInput, owner); expect(first).toEqual(second); expect(repository.createSaleCalls).toBe(1); });
  it("menghitung ulang overdue saat clock server melewati jatuh tempo", async () => { await service.createSale({ ...saleInput, dueDate: "2026-09-16" }, owner); service = new F2Service(repository, () => new Date("2026-09-17T03:00:00Z")); expect(await service.createSale({ ...saleInput, dueDate: "2026-09-16" }, owner)).toMatchObject({ ok: true, data: { paymentStatus: "overdue", status: "confirmed" } }); });
  it("memetakan kegagalan transaksi ke retryable dan tidak menyimpan hasil parsial", async () => { repository.failSale = true; expect(await service.createSale(saleInput, owner)).toMatchObject({ ok: false, error: { code: "retryable" } }); expect(repository.sales.size).toBe(0); });
  it("mengembalikan field error tanpa memanggil repository", async () => { const spy = vi.spyOn(repository, "createSaleAtomic"); const result = await service.createSale({ ...saleInput, items: [] }, owner); expect(result).toMatchObject({ ok: false, error: { code: "validation" } }); expect(spy).not.toHaveBeenCalled(); });
});
