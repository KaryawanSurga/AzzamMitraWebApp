import "server-only";
import type { OwnerProfile } from "@/lib/auth/owner";
import type { CustomerRecord, SaleMutationInput, SaleRecord, calculateSale } from "@/domain/sales";

export type { CustomerRecord, SaleRecord } from "@/domain/sales";

export type CalculatedSale = ReturnType<typeof calculateSale>;

export interface F2Repository {
  findCustomerByIdempotencyKey(key: string): Promise<CustomerRecord | null>;
  createCustomer(input: { idempotencyKey: string; name: string; whatsapp?: string; address?: string; notes?: string }, actor: OwnerProfile): Promise<CustomerRecord>;
  updateCustomer(input: { id: string; idempotencyKey: string; name?: string; whatsapp?: string; address?: string; notes?: string }, actor: OwnerProfile): Promise<CustomerRecord | null>;
  setCustomerActive(id: string, isActive: boolean, idempotencyKey: string, actor: OwnerProfile): Promise<CustomerRecord | null>;
  listCustomers(input: { query: string; includeArchived: boolean; limit: number; offset: number }): Promise<CustomerRecord[]>;
  getCustomer(id: string): Promise<CustomerRecord | null>;
  findSaleByIdempotencyKey(key: string, today: string): Promise<SaleRecord | null>;
  createSaleAtomic(input: SaleMutationInput, calculated: CalculatedSale, actor: OwnerProfile): Promise<SaleRecord>;
}

export class RepositoryConflictError extends Error {}
export class RepositoryUnavailableError extends Error { constructor(cause?: unknown) { super("Repository unavailable", { cause }); } }
