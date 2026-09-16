import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CrateBalance, CrateMovementRecord, CrateReturnInput } from "@/domain/crates";
import { quantityToMilli } from "@/domain/contracts";
import type { DeliveryCreateInput, DeliveryRecord } from "@/domain/deliveries";
import { validateDeliveryPlan } from "@/domain/deliveries";
import { summarizePayments, type PaymentCreateInput, type PaymentRecord } from "@/domain/payments";
import type { OwnerProfile } from "@/lib/auth/owner";
import { RepositoryUnavailableError } from "@/server/errors";
import { RepositoryConflictError, type DeliveryMutation, type F3Repository, type SaleBilling } from "./repository";
import { F3Service } from "./service";
const owner: OwnerProfile = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "owner@example.com", display_name: "Owner" };
const saleId = "11111111-1111-4111-8111-111111111111";
const customerId = "22222222-2222-4222-8222-222222222222";

/* Fake meniru perilaku PostgreSQL: setiap kunci idempotensi hanya boleh dipakai sekali. */
class FakeRepository implements F3Repository {
  billing: SaleBilling = { id: saleId, invoiceNumber: "INV-1", customerId, customerName: "Budi", status: "confirmed", totalRupiah: 2_000_000, paidRupiah: 0, dueDate: "2026-09-20", crateQuantityMilli: 10_000 };
  payments: PaymentRecord[] = [];
  paymentKeys = new Map<string, PaymentRecord>();
  deliveries = new Map<string, DeliveryRecord>();
  deliveryKeys = new Map<string, DeliveryRecord>();
  movements: CrateMovementRecord[] = [];
  movementKeys = new Map<string, CrateMovementRecord>();
  accounts = new Map<string, CrateBalance>([[customerId, { customerId, customerNumber: "CUS-1", customerName: "Budi", balanceMilli: 10_000 }]]);
  createPaymentCalls = 0;
  lastPaymentStatus = "";
  failNext: unknown = null;

  private guard() { if (this.failNext) throw this.failNext; }
  private fresh(key: string, seen: Map<string, unknown>) { if (seen.has(key)) throw new RepositoryConflictError(); }

  async getSaleBilling(id: string) { await Promise.resolve(); return id === this.billing.id ? this.billing : null; }
  async findPaymentByIdempotencyKey(key: string) { return this.paymentKeys.get(key) ?? null; }
  async listPayments(id: string) { return this.payments.filter((payment) => payment.saleId === id); }

  async createPaymentAtomic(input: PaymentCreateInput, billing: SaleBilling, today: string): Promise<PaymentRecord> {
    await Promise.resolve();
    const record: PaymentRecord = { id: crypto.randomUUID(), paymentNumber: `PAY-${this.payments.length + 1}`, saleId: input.saleId, amountRupiah: input.amountRupiah, method: input.method, paidAt: input.paidAt, notes: input.notes ?? null };
    this.guard(); this.fresh(input.idempotencyKey, this.paymentKeys); this.createPaymentCalls++;
    this.payments.push(record); this.paymentKeys.set(input.idempotencyKey, record);
    const summary = summarizePayments(this.payments, billing.totalRupiah, billing.dueDate, today);
    billing.paidRupiah = summary.paidRupiah; this.lastPaymentStatus = summary.paymentStatus;
    return record;
  }

  async findDeliveryByIdempotencyKey(key: string) { return this.deliveryKeys.get(key) ?? null; }
  async getDelivery(id: string) { return this.deliveries.get(id) ?? null; }
  async listDeliveries(id: string) { return [...this.deliveries.values()].filter((delivery) => delivery.saleId === id); }
  async plannedCrateQuantityMilli(id: string) { return (await this.listDeliveries(id)).reduce((total, delivery) => total + delivery.crateQuantityMilli, 0); }

  async createDeliveryAtomic(input: DeliveryCreateInput): Promise<DeliveryRecord> {
    await Promise.resolve();
    this.guard(); this.fresh(input.idempotencyKey, this.deliveryKeys);
    const record: DeliveryRecord = { id: crypto.randomUUID(), deliveryNumber: `DLV-${this.deliveries.size + 1}`, saleId: input.saleId, status: input.dispatchedAt ? "in_transit" : "unprocessed", crateQuantityMilli: quantityToMilli(input.crateQuantity), receivedCrateQuantityMilli: 0, dispatchedAt: input.dispatchedAt ?? null, receivedAt: null, notes: input.notes ?? null };
    this.deliveries.set(record.id, record); this.deliveryKeys.set(input.idempotencyKey, record);
    return record;
  }

  async updateDeliveryAtomic(mutation: DeliveryMutation): Promise<DeliveryRecord> {
    await Promise.resolve();
    this.guard(); this.fresh(mutation.idempotencyKey, this.deliveryKeys);
    const record: DeliveryRecord = { ...mutation.delivery, status: mutation.status, receivedCrateQuantityMilli: mutation.receivedCrateQuantityMilli, receivedAt: mutation.receivedAt };
    this.deliveries.set(record.id, record); this.deliveryKeys.set(mutation.idempotencyKey, record);
    return record;
  }

  async findCrateMovementByIdempotencyKey(key: string) { return this.movementKeys.get(key) ?? null; }
  async getCrateAccount(id: string) { await Promise.resolve(); return this.accounts.get(id) ?? null; }
  async listCrateBalances() { return [...this.accounts.values()]; }
  async listCrateMovements(input: { customerId: string }) { return this.movements.filter((movement) => movement.customerId === input.customerId); }

  async recordCrateReturnAtomic(input: CrateReturnInput, balanceMilli: number): Promise<CrateMovementRecord> {
    await Promise.resolve();
    this.guard(); this.fresh(input.idempotencyKey, this.movementKeys);
    const crateQuantityMilli = quantityToMilli(input.crateQuantity);
    const record: CrateMovementRecord = { id: crypto.randomUUID(), movementNumber: `CRT-${this.movements.length + 1}`, customerId: input.customerId, saleId: null, deliveryId: null, type: "return", crateQuantityMilli, occurredAt: input.occurredAt, notes: input.notes ?? null };
    this.movements.push(record); this.movementKeys.set(input.idempotencyKey, record);
    this.accounts.set(input.customerId, { ...this.accounts.get(input.customerId)!, balanceMilli: balanceMilli - crateQuantityMilli });
    return record;
  }
}

describe("F3Service", () => {
  let repository: FakeRepository;
  let service: F3Service;
  const paymentInput = (overrides: Record<string, unknown> = {}) => ({ saleId, amountRupiah: 500_000, method: "transfer", paidAt: "2026-09-15", idempotencyKey: crypto.randomUUID(), ...overrides });
  const receiptInput = (deliveryId: string, crateQuantity: string) => ({ deliveryId, crateQuantity, receivedAt: "2026-09-15", idempotencyKey: crypto.randomUUID() });

  beforeEach(() => { repository = new FakeRepository(); service = new F3Service(repository, () => new Date("2026-09-15T03:00:00Z")); });

  it("mencatat pembayaran bertahap dan menurunkan status dari agregat", async () => {
    expect(await service.createPayment(paymentInput(), owner)).toMatchObject({ ok: true, data: { amountRupiah: 500_000 } });
    expect(repository.lastPaymentStatus).toBe("partial");
    expect(await service.createPayment(paymentInput({ amountRupiah: 1_500_000 }), owner)).toMatchObject({ ok: true });
    expect(repository.billing.paidRupiah).toBe(2_000_000);
    expect(repository.lastPaymentStatus).toBe("paid");
  });

  it("menolak pembayaran melebihi sisa piutang tanpa menyentuh repository", async () => {
    const spy = vi.spyOn(repository, "createPaymentAtomic");
    expect(await service.createPayment(paymentInput({ amountRupiah: 2_500_000 }), owner)).toMatchObject({ ok: false, error: { code: "validation", fields: { amountRupiah: ["Nominal pembayaran melebihi sisa piutang."] } } });
    expect(spy).not.toHaveBeenCalled();
  });

  it("meng-idempotensikan pembayaran dengan kunci yang sama", async () => {
    const input = paymentInput();
    const [first, second] = await Promise.all([service.createPayment(input, owner), service.createPayment(input, owner)]);
    expect(first).toEqual(second);
    expect(repository.createPaymentCalls).toBe(1);
    expect(repository.payments).toHaveLength(1);
  });

  it("menolak pembayaran pada invoice yang belum dikonfirmasi", async () => {
    repository.billing = { ...repository.billing, status: "draft" };
    expect(await service.createPayment(paymentInput(), owner)).toMatchObject({ ok: false, error: { code: "validation", fields: { saleId: ["Pembayaran hanya dapat dicatat pada penjualan yang sudah dikonfirmasi."] } } });
  });

  it("mengubah pengiriman dari sebagian menjadi diterima mengikuti penerimaan bertahap", async () => {
    const created = await service.createDelivery({ saleId, crateQuantity: "10", idempotencyKey: crypto.randomUUID() }, owner);
    expect(created).toMatchObject({ ok: true, data: { status: "unprocessed", crateQuantityMilli: 10000 } });
    if (!created.ok) return;
    expect(await service.recordDeliveryReceipt(receiptInput(created.data.id, "6"), owner)).toMatchObject({ ok: true, data: { status: "partially_delivered", receivedCrateQuantityMilli: 6000, receivedAt: null } });
    expect(await service.recordDeliveryReceipt(receiptInput(created.data.id, "4"), owner)).toMatchObject({ ok: true, data: { status: "received", receivedCrateQuantityMilli: 10000, receivedAt: "2026-09-15" } });
  });

  it("menolak rencana dan penerimaan yang melebihi peti penjualan", async () => {
    expect(await service.createDelivery({ saleId, crateQuantity: "11", idempotencyKey: crypto.randomUUID() }, owner)).toMatchObject({ ok: false, error: { code: "validation", fields: { crateQuantity: [validateDeliveryPlan(10000, 0, 11000)!] } } });
    const created = await service.createDelivery({ saleId, crateQuantity: "10", idempotencyKey: crypto.randomUUID() }, owner);
    if (!created.ok) return;
    await service.recordDeliveryReceipt(receiptInput(created.data.id, "3"), owner);
    expect(await service.recordDeliveryReceipt(receiptInput(created.data.id, "8"), owner)).toMatchObject({ ok: false, error: { code: "validation", fields: { crateQuantity: ["Jumlah diterima melebihi rencana pengiriman (10 peti)."] } } });
  });

  it("memuat ditolaknya pengiriman tanpa peti pada penjualan", async () => {
    repository.billing = { ...repository.billing, crateQuantityMilli: 0 };
    expect(await service.createDelivery({ saleId, crateQuantity: "1", idempotencyKey: crypto.randomUUID() }, owner)).toMatchObject({ ok: false, error: { code: "validation", fields: { crateQuantity: ["Penjualan ini tidak mencatat peti, jadi tidak ada yang bisa dikirim."] } } });
  });

  it("meng-idempotensikan penerimaan bertahap pada kunci yang sama", async () => {
    const created = await service.createDelivery({ saleId, crateQuantity: "10", idempotencyKey: crypto.randomUUID() }, owner);
    if (!created.ok) return;
    const input = receiptInput(created.data.id, "6");
    const [first, second] = await Promise.all([service.recordDeliveryReceipt(input, owner), service.recordDeliveryReceipt(input, owner)]);
    expect(first).toEqual(second);
    expect(repository.deliveries.get(created.data.id)!.receivedCrateQuantityMilli).toBe(6000);
  });

  it("mengubah status pengiriman manual lalu menguncinya pada status terminal", async () => {
    const created = await service.createDelivery({ saleId, crateQuantity: "10", idempotencyKey: crypto.randomUUID() }, owner);
    if (!created.ok) return;
    expect(await service.setDeliveryStatus({ deliveryId: created.data.id, status: "in_transit", idempotencyKey: crypto.randomUUID() }, owner)).toMatchObject({ ok: true, data: { status: "in_transit" } });
    expect(await service.setDeliveryStatus({ deliveryId: created.data.id, status: "failed", notes: "Truk rusak", idempotencyKey: crypto.randomUUID() }, owner)).toMatchObject({ ok: true, data: { status: "failed" } });
    expect(await service.setDeliveryStatus({ deliveryId: created.data.id, status: "in_transit", idempotencyKey: crypto.randomUUID() }, owner)).toMatchObject({ ok: false, error: { code: "validation", fields: { status: ["Pengiriman yang gagal atau dibatalkan tidak dapat diubah lagi."] } } });
  });

  it("menolak pengembalian peti melebihi saldo pelanggan", async () => {
    expect(await service.recordCrateReturn({ customerId, crateQuantity: "6", occurredAt: "2026-09-15", idempotencyKey: crypto.randomUUID() }, owner)).toMatchObject({ ok: true, data: { crateQuantityMilli: 6000 } });
    expect(repository.accounts.get(customerId)!.balanceMilli).toBe(4000);
    expect(await service.recordCrateReturn({ customerId, crateQuantity: "5", occurredAt: "2026-09-15", idempotencyKey: crypto.randomUUID() }, owner)).toMatchObject({ ok: false, error: { code: "validation", fields: { crateQuantity: ["Pengembalian melebihi saldo peti pelanggan (4 peti)."] } } });
  });

  it("mengembalikan hasil pertama untuk pengembalian peti dengan kunci yang sama", async () => {
    const input = { customerId, crateQuantity: "4", occurredAt: "2026-09-15", idempotencyKey: crypto.randomUUID() };
    const [first, second] = await Promise.all([service.recordCrateReturn(input, owner), service.recordCrateReturn(input, owner)]);
    expect(first).toEqual(second);
    expect(repository.movements).toHaveLength(1);
    expect(repository.accounts.get(customerId)!.balanceMilli).toBe(6000);
  });

  it("mengembalikan data operasional invoice lengkap", async () => {
    await service.createPayment(paymentInput(), owner);
    const created = await service.createDelivery({ saleId, crateQuantity: "10", idempotencyKey: crypto.randomUUID() }, owner);
    if (!created.ok) return;
    expect(await service.getSaleOperations({ saleId }, owner)).toMatchObject({ ok: true, data: { billing: { invoiceNumber: "INV-1" }, payments: [{ amountRupiah: 500_000 }], deliveries: [{ status: "unprocessed" }] } });
  });

  it("menolak sesi kosong dan memetakan kegagalan transaksi ke retryable", async () => {
    expect(await service.createPayment(paymentInput(), null)).toMatchObject({ ok: false, error: { code: "unauthorized" } });
    expect(await service.createDelivery({ saleId, crateQuantity: "1", idempotencyKey: crypto.randomUUID() }, null)).toMatchObject({ ok: false, error: { code: "unauthorized" } });
    expect(await service.recordCrateReturn({ customerId, crateQuantity: "1", occurredAt: "2026-09-15", idempotencyKey: crypto.randomUUID() }, null)).toMatchObject({ ok: false, error: { code: "unauthorized" } });
    expect(await service.getSaleOperations({ saleId }, null)).toMatchObject({ ok: false, error: { code: "unauthorized" } });
    repository.failNext = new RepositoryUnavailableError();
    expect(await service.createPayment(paymentInput(), owner)).toMatchObject({ ok: false, error: { code: "retryable" } });
    expect(repository.payments).toHaveLength(0);
  });

  it("menolak tanggal di luar batas satu tahun dan hari yang belum terjadi", async () => {
    expect(await service.createPayment(paymentInput({ paidAt: "2024-01-01" }), owner)).toMatchObject({ ok: false, error: { code: "validation", fields: { paidAt: [expect.stringContaining("satu tahun")] } } });
    expect(await service.createPayment(paymentInput({ paidAt: "2026-09-16" }), owner)).toMatchObject({ ok: false, error: { code: "validation", fields: { paidAt: [expect.stringContaining("masa depan")] } } });
  });
});
