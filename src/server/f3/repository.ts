import "server-only";
import type { CrateBalance, CrateMovementRecord, CrateReturnInput } from "@/domain/crates";
import type { DeliveryCreateInput, DeliveryRecord, DeliveryStatus } from "@/domain/deliveries";
import type { PaymentCreateInput, PaymentRecord } from "@/domain/payments";
import type { OwnerProfile } from "@/lib/auth/owner";

export type { CrateBalance, CrateMovementRecord, CrateReturnInput, DeliveryRecord, PaymentRecord };
export { RepositoryConflictError, RepositoryUnavailableError } from "@/server/errors";

/* Ringkasan invoice yang dibutuhkan F3 untuk memvalidasi mutasi. */
export type SaleBilling = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  status: "draft" | "confirmed";
  totalRupiah: number;
  paidRupiah: number;
  dueDate: string | null;
  crateQuantityMilli: number;
};

export type DeliveryMutation = {
  delivery: DeliveryRecord;
  status: DeliveryStatus;
  receivedCrateQuantityMilli: number;
  receivedAt: string | null;
  action: string;
  notes?: string;
  idempotencyKey: string;
};

export interface F3Repository {
  getSaleBilling(saleId: string): Promise<SaleBilling | null>;
  findPaymentByIdempotencyKey(key: string): Promise<PaymentRecord | null>;
  listPayments(saleId: string): Promise<PaymentRecord[]>;
  createPaymentAtomic(input: PaymentCreateInput, billing: SaleBilling, today: string, actor: OwnerProfile): Promise<PaymentRecord>;

  findDeliveryByIdempotencyKey(key: string): Promise<DeliveryRecord | null>;
  getDelivery(id: string): Promise<DeliveryRecord | null>;
  listDeliveries(saleId: string): Promise<DeliveryRecord[]>;
  plannedCrateQuantityMilli(saleId: string): Promise<number>;
  createDeliveryAtomic(input: DeliveryCreateInput, actor: OwnerProfile): Promise<DeliveryRecord>;
  updateDeliveryAtomic(mutation: DeliveryMutation, actor: OwnerProfile): Promise<DeliveryRecord>;

  findCrateMovementByIdempotencyKey(key: string): Promise<CrateMovementRecord | null>;
  getCrateAccount(customerId: string): Promise<CrateBalance | null>;
  listCrateBalances(input: { query: string; limit: number; offset: number }): Promise<CrateBalance[]>;
  listCrateMovements(input: { customerId: string; limit: number; offset: number }): Promise<CrateMovementRecord[]>;
  recordCrateReturnAtomic(input: CrateReturnInput, balanceMilli: number, actor: OwnerProfile): Promise<CrateMovementRecord>;
}
