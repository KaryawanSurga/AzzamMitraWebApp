import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OwnerProfile } from "@/lib/auth/owner";
import { derivePaymentStatus, type SaleDetail, type SaleMutationInput } from "@/domain/sales";
import { RepositoryConflictError, RepositoryUnavailableError, type CalculatedSale, type CustomerRecord, type F2Repository, type SaleAdjustmentRecord, type SaleAuditRecord, type SaleRecord } from "./repository";
import { F2Service } from "./service";

const owner: OwnerProfile = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "owner@example.com", display_name: "Owner" };
const saleInput = { customerId: "11111111-1111-4111-8111-111111111111", transactionDate: "2026-09-15", items: [{ description: "Telur", pricingBasis: "kg", crateQuantity: "10", weightKg: "103.5", unitPriceRupiah: 25000 }], discountRupiah: 0, feeRupiah: 0, paymentChoice: "down_payment", initialPaymentRupiah: 1000000, paymentMethod: "transfer", dueDate: "2026-10-15", idempotencyKey: "22222222-2222-4222-8222-222222222222", status: "confirmed" };

class FakeRepository implements F2Repository {
  customers: CustomerRecord[] = []; customerKeys = new Map<string, CustomerRecord>(); sales = new Map<string, SaleRecord>(); details = new Map<string, SaleDetail>();
  adjustmentKeys = new Map<string, string>(); adjustments = new Map<string, SaleAdjustmentRecord[]>(); auditEvents = new Map<string, SaleAuditRecord[]>();
  createSaleCalls = 0; failSale = false;
  async findCustomerByIdempotencyKey(key: string) { return this.customerKeys.get(key) ?? null; }
  async createCustomer(input: { idempotencyKey: string; name: string; whatsapp?: string; address?: string; notes?: string }): Promise<CustomerRecord> { await Promise.resolve(); if (this.customerKeys.has(input.idempotencyKey)) throw new RepositoryConflictError(); const record = { id: crypto.randomUUID(), customerNumber: `CUS-${this.customers.length + 1}`, name: input.name, whatsapp: input.whatsapp ?? null, address: input.address ?? null, notes: input.notes ?? null, isActive: true }; this.customers.push(record); this.customerKeys.set(input.idempotencyKey, record); return record; }
  async updateCustomer(input: { id: string; idempotencyKey: string; name?: string; whatsapp?: string; address?: string; notes?: string }): Promise<CustomerRecord | null> { const record = this.customers.find(({ id }) => id === input.id); if (!record) return null; Object.assign(record, input); this.customerKeys.set(input.idempotencyKey, record); return record; }
  async setCustomerActive(id: string, isActive: boolean, idempotencyKey: string): Promise<CustomerRecord | null> { const record = this.customers.find((item) => item.id === id); if (!record) return null; record.isActive = isActive; this.customerKeys.set(idempotencyKey, record); return record; }
  async listCustomers(input: { query: string; includeArchived: boolean; limit: number; offset: number }): Promise<CustomerRecord[]> { return this.customers.filter((item) => (input.includeArchived || item.isActive) && item.name.includes(input.query)).slice(input.offset, input.offset + input.limit); }
  async getCustomer(id: string): Promise<CustomerRecord | null> { return this.customers.find((item) => item.id === id) ?? null; }
  async findSaleByIdempotencyKey(key: string, today: string): Promise<SaleRecord | null> { const record = this.sales.get(key); return record ? { ...record, paymentStatus: derivePaymentStatus(record.remainingRupiah, record.paidRupiah, record.dueDate, today) } : null; }
  async createSaleAtomic(input: SaleMutationInput, calculated: CalculatedSale): Promise<SaleRecord> { this.createSaleCalls++; if (this.failSale) throw new RepositoryUnavailableError(); const record: SaleRecord = { id: crypto.randomUUID(), invoiceNumber: "INV-1", idempotencyKey: input.idempotencyKey, totalRupiah: calculated.totalRupiah, paidRupiah: calculated.paidRupiah, remainingRupiah: calculated.remainingRupiah, dueDate: input.dueDate ?? null, paymentStatus: calculated.paymentStatus, status: input.status }; this.sales.set(input.idempotencyKey, record); this.details.set(record.id, { ...record, customerId: input.customerId, customerNumber: "CUS-1", customerName: "Budi", transactionDate: input.transactionDate, subtotalRupiah: calculated.subtotalRupiah, discountRupiah: input.discountRupiah, feeRupiah: input.feeRupiah, notes: input.notes ?? null, cancelledAt: null, items: calculated.items.map((item, index) => ({ id: `item-${index}`, description: item.description, pricingBasis: item.pricingBasis, crateQuantity: item.crateQuantity ?? null, weightKg: item.weightKg ?? null, unitPriceRupiah: item.unitPriceRupiah, subtotalRupiah: item.subtotalRupiah })), payments: [] }); return record; }
  async listSales() { return []; }
  async getSale(id: string) { return this.details.get(id) ?? null; }
  async findAdjustmentByIdempotencyKey(key: string) { const saleId = this.adjustmentKeys.get(key); return saleId ? { saleId } : null; }
  async cancelSaleAtomic(input: { saleId: string; idempotencyKey: string; reason: string }, actor: OwnerProfile, today: string) { const detail = this.details.get(input.saleId); if (!detail) return null; detail.status = "cancelled"; detail.cancelledAt = new Date().toISOString(); const record: SaleAdjustmentRecord = { id: crypto.randomUUID(), adjustmentNumber: "ADJ-1", type: "cancellation", amountRupiah: detail.totalRupiah, reason: input.reason, occurredAt: detail.cancelledAt, actorName: actor.display_name }; this.adjustmentKeys.set(input.idempotencyKey, input.saleId); this.adjustments.set(input.saleId, [...(this.adjustments.get(input.saleId) ?? []), record]); this.auditEvents.set(input.saleId, [...(this.auditEvents.get(input.saleId) ?? []), { id: crypto.randomUUID(), action: "sale.cancelled", reason: input.reason, actorName: actor.display_name, occurredAt: record.occurredAt }]); return { ...detail, paymentStatus: derivePaymentStatus(detail.remainingRupiah, detail.paidRupiah, detail.dueDate, today) }; }
  async correctSaleAtomic(input: { saleId: string; idempotencyKey: string; reason: string; discountRupiah: number; feeRupiah: number; totalRupiah: number; dueDate: string | null; notes: string | null; changes: string[] }, actor: OwnerProfile, today: string) { const detail = this.details.get(input.saleId); if (!detail) return null; const previousTotal = detail.totalRupiah; detail.discountRupiah = input.discountRupiah; detail.feeRupiah = input.feeRupiah; detail.totalRupiah = input.totalRupiah; detail.dueDate = input.dueDate; detail.notes = input.notes; detail.remainingRupiah = input.totalRupiah - detail.paidRupiah; const record: SaleAdjustmentRecord = { id: crypto.randomUUID(), adjustmentNumber: "ADJ-2", type: "correction", amountRupiah: Math.abs(input.totalRupiah - previousTotal), reason: input.reason, occurredAt: new Date().toISOString(), actorName: actor.display_name }; this.adjustmentKeys.set(input.idempotencyKey, input.saleId); this.adjustments.set(input.saleId, [...(this.adjustments.get(input.saleId) ?? []), record]); this.auditEvents.set(input.saleId, [...(this.auditEvents.get(input.saleId) ?? []), { id: crypto.randomUUID(), action: "sale.corrected", reason: input.reason, actorName: actor.display_name, occurredAt: record.occurredAt }]); return { ...detail, paymentStatus: derivePaymentStatus(detail.remainingRupiah, detail.paidRupiah, detail.dueDate, today) }; }
  async listSaleAdjustments(saleId: string) { return this.adjustments.get(saleId) ?? []; }
  async listSaleAuditEvents(saleId: string) { return this.auditEvents.get(saleId) ?? []; }
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

  it("UAT-10: membatalkan invoice terkonfirmasi dengan alasan, audit, dan idempotensi", async () => {
    const created = await service.createSale(saleInput, owner);
    if (!created.ok) throw new Error("penjualan harus tersimpan");
    const input = { saleId: created.data.id, reason: "Pelanggan membatalkan pesanan", idempotencyKey: crypto.randomUUID() };
    const cancelled = await service.cancelSale(input, owner);
    expect(cancelled).toMatchObject({ ok: true, data: { status: "cancelled" } });
    expect(await service.cancelSale(input, owner)).toEqual(cancelled);
    expect(await service.cancelSale({ ...input, idempotencyKey: crypto.randomUUID() }, owner)).toMatchObject({ ok: false, error: { code: "conflict" } });
    expect(repository.auditEvents.get(created.data.id)).toMatchObject([{ action: "sale.cancelled", reason: input.reason }]);
    expect(repository.adjustments.get(created.data.id)).toMatchObject([{ type: "cancellation", amountRupiah: created.data.totalRupiah }]);
  });

  it("UAT-10: menolak pembatalan draft dan pembatalan tanpa alasan", async () => {
    const draft = await service.createSale({ ...saleInput, status: "draft", paymentChoice: "debt", initialPaymentRupiah: 0, paymentMethod: undefined, dueDate: undefined, idempotencyKey: crypto.randomUUID() }, owner);
    if (!draft.ok) throw new Error("draft harus tersimpan");
    expect(await service.cancelSale({ saleId: draft.data.id, reason: "Salah buat draft", idempotencyKey: crypto.randomUUID() }, owner)).toMatchObject({ ok: false, error: { code: "conflict" } });
    expect(await service.cancelSale({ saleId: draft.data.id, reason: "pendek", idempotencyKey: crypto.randomUUID() }, owner)).toMatchObject({ ok: false, error: { code: "validation" } });
  });

  it("UAT-10: mengoreksi diskon dan jatuh tempo dengan total baru serta riwayat", async () => {
    const created = await service.createSale(saleInput, owner);
    if (!created.ok) throw new Error("penjualan harus tersimpan");
    const corrected = await service.correctSale({ saleId: created.data.id, discountRupiah: 87_500, dueDate: "2026-10-20", reason: "Diskon disepakati ulang", idempotencyKey: crypto.randomUUID() }, owner);
    expect(corrected).toMatchObject({ ok: true, data: { totalRupiah: 2_500_000, dueDate: "2026-10-20" } });
    const history = await service.getSaleHistory({ id: created.data.id }, owner);
    expect(history).toMatchObject({ ok: true, data: { adjustments: [{ type: "correction" }], auditEvents: [{ action: "sale.corrected" }] } });
  });

  it("UAT-10: menolak koreksi yang membuat total di bawah pembayaran diterima", async () => {
    const created = await service.createSale(saleInput, owner);
    if (!created.ok) throw new Error("penjualan harus tersimpan");
    const result = await service.correctSale({ saleId: created.data.id, discountRupiah: 2_000_000, reason: "Potongan terlalu besar", idempotencyKey: crypto.randomUUID() }, owner);
    expect(result).toMatchObject({ ok: false, error: { code: "validation", fields: { discountRupiah: [expect.stringContaining("pembayaran")] } } });
  });

  it("menolak koreksi invoice yang sudah dibatalkan", async () => {
    const created = await service.createSale(saleInput, owner);
    if (!created.ok) throw new Error("penjualan harus tersimpan");
    await service.cancelSale({ saleId: created.data.id, reason: "Invoice batal", idempotencyKey: crypto.randomUUID() }, owner);
    expect(await service.correctSale({ saleId: created.data.id, feeRupiah: 10_000, reason: "Koreksi setelah batal", idempotencyKey: crypto.randomUUID() }, owner)).toMatchObject({ ok: false, error: { code: "conflict" } });
  });
});
