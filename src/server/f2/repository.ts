import "server-only";
import type { OwnerProfile } from "@/lib/auth/owner";
import type { AdjustmentType } from "@/domain/adjustments";
import type { CustomerRecord, SaleDetail, SaleListItem, SaleMutationInput, SaleRecord, calculateSale } from "@/domain/sales";

export type { CustomerRecord, SaleRecord } from "@/domain/sales";

export type CalculatedSale = ReturnType<typeof calculateSale>;

export type SaleAdjustmentRecord = {
  id: string;
  adjustmentNumber: string;
  type: AdjustmentType;
  amountRupiah: number;
  reason: string;
  occurredAt: string;
  actorName: string;
};

export type SaleAuditRecord = {
  id: string;
  action: string;
  reason: string | null;
  actorName: string;
  occurredAt: string;
};

export type SaleCancellationPersistInput = { saleId: string; idempotencyKey: string; reason: string };

export type SaleCorrectionPersistInput = {
  saleId: string;
  idempotencyKey: string;
  reason: string;
  discountRupiah: number;
  feeRupiah: number;
  totalRupiah: number;
  dueDate: string | null;
  notes: string | null;
  changes: string[];
};

export interface F2Repository {
  findCustomerByIdempotencyKey(key: string): Promise<CustomerRecord | null>;
  createCustomer(input: { idempotencyKey: string; name: string; whatsapp?: string; address?: string; notes?: string }, actor: OwnerProfile): Promise<CustomerRecord>;
  updateCustomer(input: { id: string; idempotencyKey: string; name?: string; whatsapp?: string; address?: string; notes?: string }, actor: OwnerProfile): Promise<CustomerRecord | null>;
  setCustomerActive(id: string, isActive: boolean, idempotencyKey: string, actor: OwnerProfile): Promise<CustomerRecord | null>;
  listCustomers(input: { query: string; includeArchived: boolean; limit: number; offset: number }): Promise<CustomerRecord[]>;
  getCustomer(id: string): Promise<CustomerRecord | null>;
  findSaleByIdempotencyKey(key: string, today: string): Promise<SaleRecord | null>;
  createSaleAtomic(input: SaleMutationInput, calculated: CalculatedSale, actor: OwnerProfile): Promise<SaleRecord>;
  listSales(input: { query: string; limit: number; offset: number }, today: string): Promise<SaleListItem[]>;
  getSale(id: string, today: string): Promise<SaleDetail | null>;
  findAdjustmentByIdempotencyKey(key: string): Promise<{ saleId: string } | null>;
  cancelSaleAtomic(input: SaleCancellationPersistInput, actor: OwnerProfile, today: string): Promise<SaleRecord | null>;
  correctSaleAtomic(input: SaleCorrectionPersistInput, actor: OwnerProfile, today: string): Promise<SaleRecord | null>;
  listSaleAdjustments(saleId: string): Promise<SaleAdjustmentRecord[]>;
  listSaleAuditEvents(saleId: string): Promise<SaleAuditRecord[]>;
}

export { RepositoryConflictError, RepositoryUnavailableError } from "@/server/errors";
