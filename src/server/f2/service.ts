import "server-only";
import { customerArchiveSchema, customerCreateSchema, customerIdSchema, customerListSchema, customerUpdateSchema, saleIdSchema, saleListSchema, saleMutationSchema, calculateSale, jakartaDate, validateTransactionDate } from "@/domain/sales";
import type { OwnerProfile } from "@/lib/auth/owner";
import type { AppResult } from "@/server/result";
import { unauthorizedResult } from "@/server/result";
import { RepositoryConflictError, type CustomerRecord, type F2Repository, type SaleRecord } from "./repository";
import type { z } from "zod";

function validation(error: z.ZodError): AppResult<never> { return { ok: false, error: { code: "validation", message: "Periksa kembali data yang diisi.", fields: error.flatten().fieldErrors } }; }
function failure(error: unknown): AppResult<never> {
  if (error instanceof RepositoryConflictError) return { ok: false, error: { code: "conflict", message: "Data dengan nomor atau kunci yang sama sudah tersimpan." } };
  return { ok: false, error: { code: "retryable", message: "Data belum dapat disimpan. Silakan coba lagi." } };
}

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
}
