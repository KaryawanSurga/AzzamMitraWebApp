import "server-only";
import { buildSaleCorrection, isCancellableStatus, saleCancellationSchema, saleCorrectionSchema } from "@/domain/adjustments";
import { customerArchiveSchema, customerCreateSchema, customerIdSchema, customerListSchema, customerUpdateSchema, saleIdSchema, saleListSchema, saleMutationSchema, calculateSale, jakartaDate, validateTransactionDate } from "@/domain/sales";
import type { OwnerProfile } from "@/lib/auth/owner";
import { fieldFailure, repositoryFailure, unauthorizedResult, validationFailure, type AppResult } from "@/server/result";
import { RepositoryConflictError, type CustomerRecord, type F2Repository, type SaleRecord } from "./repository";

const validation = validationFailure;
const failure = repositoryFailure;
const conflict = (message: string): AppResult<never> => ({ ok: false, error: { code: "conflict", message } });

export class F2Service {
  constructor(private readonly repository: F2Repository, private readonly now: () => Date = () => new Date()) {}
  private async customerMutation(key: string, mutate: () => Promise<CustomerRecord | null>): Promise<AppResult<CustomerRecord>> { try { const existing = await this.repository.findCustomerByIdempotencyKey(key); if (existing) return { ok: true, data: existing }; const data = await mutate(); return data ? { ok: true, data } : { ok: false, error: { code: "not_found", message: "Pelanggan tidak ditemukan." } }; } catch (error) { if (error instanceof RepositoryConflictError) { try { const existing = await this.repository.findCustomerByIdempotencyKey(key); if (existing) return { ok: true, data: existing }; } catch { /* sanitized below */ } } return failure(error); } }
  async createCustomer(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<CustomerRecord>> { if (!owner) return unauthorizedResult(); const parsed = customerCreateSchema.safeParse(raw); if (!parsed.success) return validation(parsed.error); return this.customerMutation(parsed.data.idempotencyKey, () => this.repository.createCustomer(parsed.data, owner)); }
  async updateCustomer(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<CustomerRecord>> { if (!owner) return unauthorizedResult(); const parsed = customerUpdateSchema.safeParse(raw); if (!parsed.success) return validation(parsed.error); return this.customerMutation(parsed.data.idempotencyKey, () => this.repository.updateCustomer(parsed.data, owner)); }
  async archiveCustomer(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<CustomerRecord>> { if (!owner) return unauthorizedResult(); const parsed = customerArchiveSchema.safeParse(raw); if (!parsed.success) return validation(parsed.error); return this.customerMutation(parsed.data.idempotencyKey, () => this.repository.setCustomerActive(parsed.data.id, false, parsed.data.idempotencyKey, owner)); }
  async listCustomers(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<CustomerRecord[]>> { if (!owner) return unauthorizedResult(); const parsed = customerListSchema.safeParse(raw); if (!parsed.success) return validation(parsed.error); try { return { ok: true, data: await this.repository.listCustomers(parsed.data) }; } catch { return { ok: false, error: { code: "retryable", message: "Daftar pelanggan belum dapat dimuat. Silakan coba lagi." } }; } }
  async getCustomer(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<CustomerRecord>> { if (!owner) return unauthorizedResult(); const parsed = customerIdSchema.safeParse(raw); if (!parsed.success) return validation(parsed.error); try { const data = await this.repository.getCustomer(parsed.data.id); return data ? { ok: true, data } : { ok: false, error: { code: "not_found", message: "Pelanggan tidak ditemukan." } }; } catch { return { ok: false, error: { code: "retryable", message: "Detail pelanggan belum dapat dimuat. Silakan coba lagi." } }; } }
  async createSale(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<SaleRecord>> {
    if (!owner) return unauthorizedResult(); const parsed = saleMutationSchema.safeParse(raw); if (!parsed.success) return validation(parsed.error);
    const dateError = validateTransactionDate(parsed.data.transactionDate, this.now()); if (dateError) return { ok: false, error: { code: "validation", message: dateError, fields: { transactionDate: [dateError] } } };
    let calculated: ReturnType<typeof calculateSale>; try { calculated = calculateSale(parsed.data, jakartaDate(this.now())); } catch (error) { const message = error instanceof Error ? error.message : "Perhitungan penjualan tidak valid."; return { ok: false, error: { code: "validation", message, fields: { items: [message] } } }; }
    try {
      const today = jakartaDate(this.now()); const existing = await this.repository.findSaleByIdempotencyKey(parsed.data.idempotencyKey, today); if (existing) return { ok: true, data: existing };
      return { ok: true, data: await this.repository.createSaleAtomic(parsed.data, calculated, owner) };
    } catch (error) {
      if (error instanceof RepositoryConflictError) { try { const existing = await this.repository.findSaleByIdempotencyKey(parsed.data.idempotencyKey, jakartaDate(this.now())); if (existing) return { ok: true, data: existing }; } catch { /* return sanitized conflict */ } }
      return failure(error);
    }
  }
  async listSales(raw: unknown, owner: OwnerProfile | null) { if (!owner) return unauthorizedResult(); const parsed = saleListSchema.safeParse(raw); if (!parsed.success) return validation(parsed.error); try { return { ok: true as const, data: await this.repository.listSales(parsed.data, jakartaDate(this.now())) }; } catch { return { ok: false as const, error: { code: "retryable" as const, message: "Daftar penjualan belum dapat dimuat. Silakan coba lagi." } }; } }
  async getSale(raw: unknown, owner: OwnerProfile | null) { if (!owner) return unauthorizedResult(); const parsed = saleIdSchema.safeParse(raw); if (!parsed.success) return validation(parsed.error); try { const data = await this.repository.getSale(parsed.data.id, jakartaDate(this.now())); return data ? { ok: true as const, data } : { ok: false as const, error: { code: "not_found" as const, message: "Penjualan tidak ditemukan." } }; } catch { return { ok: false as const, error: { code: "retryable" as const, message: "Detail penjualan belum dapat dimuat. Silakan coba lagi." } }; } }

  async getSaleHistory(raw: unknown, owner: OwnerProfile | null) {
    if (!owner) return unauthorizedResult(); const parsed = saleIdSchema.safeParse(raw); if (!parsed.success) return validation(parsed.error);
    try { const [adjustments, auditEvents] = await Promise.all([this.repository.listSaleAdjustments(parsed.data.id), this.repository.listSaleAuditEvents(parsed.data.id)]); return { ok: true as const, data: { adjustments, auditEvents } }; }
    catch { return { ok: false as const, error: { code: "retryable" as const, message: "Riwayat invoice belum dapat dimuat. Silakan coba lagi." } }; }
  }

  async cancelSale(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<SaleRecord>> {
    if (!owner) return unauthorizedResult(); const parsed = saleCancellationSchema.safeParse(raw); if (!parsed.success) return validation(parsed.error);
    try {
      const existing = await this.repository.findAdjustmentByIdempotencyKey(parsed.data.idempotencyKey);
      if (existing) return this.saleRecordOrMissing(existing.saleId);
      const sale = await this.repository.getSale(parsed.data.saleId, jakartaDate(this.now()));
      if (!sale) return { ok: false, error: { code: "not_found", message: "Penjualan tidak ditemukan." } };
      if (sale.status === "cancelled") return conflict("Invoice ini sudah dibatalkan.");
      if (!isCancellableStatus(sale.status)) return conflict("Hanya invoice terkonfirmasi yang dapat dibatalkan.");
      const data = await this.repository.cancelSaleAtomic(parsed.data, owner, jakartaDate(this.now()));
      return data ? { ok: true, data } : { ok: false, error: { code: "not_found", message: "Penjualan tidak ditemukan." } };
    } catch (error) {
      if (error instanceof RepositoryConflictError) { try { const existing = await this.repository.findAdjustmentByIdempotencyKey(parsed.data.idempotencyKey); if (existing) return this.saleRecordOrMissing(existing.saleId); } catch { /* sanitized below */ } }
      return failure(error);
    }
  }

  async correctSale(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<SaleRecord>> {
    if (!owner) return unauthorizedResult(); const parsed = saleCorrectionSchema.safeParse(raw); if (!parsed.success) return validation(parsed.error);
    try {
      const existing = await this.repository.findAdjustmentByIdempotencyKey(parsed.data.idempotencyKey);
      if (existing) return this.saleRecordOrMissing(existing.saleId);
      const sale = await this.repository.getSale(parsed.data.saleId, jakartaDate(this.now()));
      if (!sale) return { ok: false, error: { code: "not_found", message: "Penjualan tidak ditemukan." } };
      if (sale.status === "cancelled") return conflict("Invoice yang sudah dibatalkan tidak dapat dikoreksi.");
      if (!isCancellableStatus(sale.status)) return conflict("Hanya invoice terkonfirmasi yang dapat dikoreksi.");
      const plan = buildSaleCorrection({ subtotalRupiah: sale.subtotalRupiah, discountRupiah: sale.discountRupiah, feeRupiah: sale.feeRupiah, totalRupiah: sale.totalRupiah, paidRupiah: sale.paidRupiah, transactionDate: sale.transactionDate, dueDate: sale.dueDate, notes: sale.notes }, parsed.data);
      if (!plan.ok) return fieldFailure(plan.field ?? "reason", plan.message);
      const data = await this.repository.correctSaleAtomic({ saleId: parsed.data.saleId, idempotencyKey: parsed.data.idempotencyKey, reason: parsed.data.reason, changes: plan.changes, ...plan.next }, owner, jakartaDate(this.now()));
      return data ? { ok: true, data } : { ok: false, error: { code: "not_found", message: "Penjualan tidak ditemukan." } };
    } catch (error) {
      if (error instanceof RepositoryConflictError) { try { const existing = await this.repository.findAdjustmentByIdempotencyKey(parsed.data.idempotencyKey); if (existing) return this.saleRecordOrMissing(existing.saleId); } catch { /* sanitized below */ } }
      return failure(error);
    }
  }

  private async saleRecordOrMissing(saleId: string): Promise<AppResult<SaleRecord>> {
    const sale = await this.repository.getSale(saleId, jakartaDate(this.now()));
    return sale ? { ok: true, data: sale } : { ok: false, error: { code: "not_found", message: "Penjualan tidak ditemukan." } };
  }
}
