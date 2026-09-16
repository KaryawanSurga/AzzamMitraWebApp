import "server-only";
import { quantityToMilli } from "@/domain/contracts";
import { crateBalanceListInputSchema, crateHistoryInputSchema, crateReturnSchema, validateCrateReturn } from "@/domain/crates";
import type { CrateBalance, CrateMovementRecord } from "@/domain/crates";
import { deliveryCreateSchema, deliveryReceiptSchema, deliveryStatusUpdateSchema, deriveDeliveryStatus, validateDeliveryPlan, validateDeliveryReceipt, validateDeliveryStatusChange } from "@/domain/deliveries";
import type { DeliveryRecord } from "@/domain/deliveries";
import { paymentCreateSchema, saleOperationsInputSchema, validatePaymentAmount } from "@/domain/payments";
import type { PaymentRecord } from "@/domain/payments";
import { customerIdSchema, jakartaDate, validateTransactionDate } from "@/domain/sales";
import type { OwnerProfile } from "@/lib/auth/owner";
import { fieldFailure, notFoundFailure, repositoryFailure, unauthorizedResult, validationFailure, type AppResult } from "@/server/result";
import { RepositoryConflictError, type F3Repository, type SaleBilling } from "./repository";

export type SaleOperations = { billing: SaleBilling; payments: PaymentRecord[]; deliveries: DeliveryRecord[] };

export class F3Service {
  constructor(private readonly repository: F3Repository, private readonly now: () => Date = () => new Date()) {}

  async getSaleOperations(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<SaleOperations>> {
    if (!owner) return unauthorizedResult();
    const parsed = saleOperationsInputSchema.safeParse(raw);
    if (!parsed.success) return validationFailure(parsed.error);
    try {
      const billing = await this.repository.getSaleBilling(parsed.data.saleId);
      if (!billing) return notFoundFailure("Invoice tidak ditemukan.");
      const [payments, deliveries] = await Promise.all([this.repository.listPayments(parsed.data.saleId), this.repository.listDeliveries(parsed.data.saleId)]);
      return { ok: true, data: { billing, payments, deliveries } };
    } catch {
      return { ok: false, error: { code: "retryable", message: "Data operasional invoice belum dapat dimuat. Silakan coba lagi." } };
    }
  }

  async createPayment(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<PaymentRecord>> {
    if (!owner) return unauthorizedResult();
    const parsed = paymentCreateSchema.safeParse(raw);
    if (!parsed.success) return validationFailure(parsed.error);
    const dateError = validateTransactionDate(parsed.data.paidAt, this.now());
    if (dateError) return fieldFailure("paidAt", dateError);
    try {
      const billing = await this.repository.getSaleBilling(parsed.data.saleId);
      if (!billing) return notFoundFailure("Invoice tidak ditemukan.");
      const existing = await this.repository.findPaymentByIdempotencyKey(parsed.data.idempotencyKey);
      if (existing) return { ok: true, data: existing };
      if (billing.status !== "confirmed") return fieldFailure("saleId", "Pembayaran hanya dapat dicatat pada penjualan yang sudah dikonfirmasi.");
      const amountError = validatePaymentAmount(parsed.data.amountRupiah, billing.totalRupiah - billing.paidRupiah);
      if (amountError) return fieldFailure("amountRupiah", amountError);
      return { ok: true, data: await this.repository.createPaymentAtomic(parsed.data, billing, jakartaDate(this.now()), owner) };
    } catch (error) {
      return this.sanitizedFailure(error, () => this.repository.findPaymentByIdempotencyKey(parsed.data.idempotencyKey));
    }
  }

  async createDelivery(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<DeliveryRecord>> {
    if (!owner) return unauthorizedResult();
    const parsed = deliveryCreateSchema.safeParse(raw);
    if (!parsed.success) return validationFailure(parsed.error);
    if (parsed.data.dispatchedAt) {
      const dispatchedError = validateTransactionDate(parsed.data.dispatchedAt, this.now());
      if (dispatchedError) return fieldFailure("dispatchedAt", dispatchedError);
    }
    try {
      const billing = await this.repository.getSaleBilling(parsed.data.saleId);
      if (!billing) return notFoundFailure("Invoice tidak ditemukan.");
      const existing = await this.repository.findDeliveryByIdempotencyKey(parsed.data.idempotencyKey);
      if (existing) return { ok: true, data: existing };
      if (billing.status !== "confirmed") return fieldFailure("saleId", "Pengiriman hanya dapat dicatat pada penjualan yang sudah dikonfirmasi.");
      const planError = validateDeliveryPlan(billing.crateQuantityMilli, await this.repository.plannedCrateQuantityMilli(parsed.data.saleId), quantityToMilli(parsed.data.crateQuantity));
      if (planError) return fieldFailure("crateQuantity", planError);
      return { ok: true, data: await this.repository.createDeliveryAtomic(parsed.data, owner) };
    } catch (error) {
      return this.sanitizedFailure(error, () => this.repository.findDeliveryByIdempotencyKey(parsed.data.idempotencyKey));
    }
  }

  async recordDeliveryReceipt(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<DeliveryRecord>> {
    if (!owner) return unauthorizedResult();
    const parsed = deliveryReceiptSchema.safeParse(raw);
    if (!parsed.success) return validationFailure(parsed.error);
    const dateError = validateTransactionDate(parsed.data.receivedAt, this.now());
    if (dateError) return fieldFailure("receivedAt", dateError);
    try {
      const delivery = await this.repository.getDelivery(parsed.data.deliveryId);
      if (!delivery) return notFoundFailure("Pengiriman tidak ditemukan.");
      const existing = await this.repository.findDeliveryByIdempotencyKey(parsed.data.idempotencyKey);
      if (existing) return { ok: true, data: existing };
      const incomingMilli = quantityToMilli(parsed.data.crateQuantity);
      const receiptError = validateDeliveryReceipt(delivery.crateQuantityMilli, delivery.receivedCrateQuantityMilli, incomingMilli, delivery.status);
      if (receiptError) return fieldFailure("crateQuantity", receiptError);
      const receivedCrateQuantityMilli = delivery.receivedCrateQuantityMilli + incomingMilli;
      const status = deriveDeliveryStatus(delivery.crateQuantityMilli, receivedCrateQuantityMilli, delivery.status);
      const action = status === "received" ? "delivery.received" : "delivery.partially_received";
      return { ok: true, data: await this.repository.updateDeliveryAtomic({ delivery, status, receivedCrateQuantityMilli, receivedAt: status === "received" ? parsed.data.receivedAt : null, action, notes: parsed.data.notes, idempotencyKey: parsed.data.idempotencyKey }, owner) };
    } catch (error) {
      return this.sanitizedFailure(error, () => this.repository.findDeliveryByIdempotencyKey(parsed.data.idempotencyKey));
    }
  }

  async setDeliveryStatus(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<DeliveryRecord>> {
    if (!owner) return unauthorizedResult();
    const parsed = deliveryStatusUpdateSchema.safeParse(raw);
    if (!parsed.success) return validationFailure(parsed.error);
    try {
      const delivery = await this.repository.getDelivery(parsed.data.deliveryId);
      if (!delivery) return notFoundFailure("Pengiriman tidak ditemukan.");
      const existing = await this.repository.findDeliveryByIdempotencyKey(parsed.data.idempotencyKey);
      if (existing) return { ok: true, data: existing };
      const statusError = validateDeliveryStatusChange(delivery.status, parsed.data.status);
      if (statusError) return fieldFailure("status", statusError);
      return { ok: true, data: await this.repository.updateDeliveryAtomic({ delivery, status: parsed.data.status, receivedCrateQuantityMilli: delivery.receivedCrateQuantityMilli, receivedAt: null, action: "delivery.status_changed", notes: parsed.data.notes, idempotencyKey: parsed.data.idempotencyKey }, owner) };
    } catch (error) {
      return this.sanitizedFailure(error, () => this.repository.findDeliveryByIdempotencyKey(parsed.data.idempotencyKey));
    }
  }

  async getCrateAccount(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<CrateBalance>> {
    if (!owner) return unauthorizedResult();
    const parsed = customerIdSchema.safeParse(raw);
    if (!parsed.success) return validationFailure(parsed.error);
    try {
      const account = await this.repository.getCrateAccount(parsed.data.id);
      return account ? { ok: true, data: account } : notFoundFailure("Pelanggan tidak ditemukan.");
    } catch {
      return { ok: false, error: { code: "retryable", message: "Saldo peti belum dapat dimuat. Silakan coba lagi." } };
    }
  }

  async listCrateBalances(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<CrateBalance[]>> {
    if (!owner) return unauthorizedResult();
    const parsed = crateBalanceListInputSchema.safeParse(raw);
    if (!parsed.success) return validationFailure(parsed.error);
    try {
      return { ok: true, data: await this.repository.listCrateBalances(parsed.data) };
    } catch {
      return { ok: false, error: { code: "retryable", message: "Daftar saldo peti belum dapat dimuat. Silakan coba lagi." } };
    }
  }

  async listCrateMovements(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<CrateMovementRecord[]>> {
    if (!owner) return unauthorizedResult();
    const parsed = crateHistoryInputSchema.safeParse(raw);
    if (!parsed.success) return validationFailure(parsed.error);
    try {
      return { ok: true, data: await this.repository.listCrateMovements(parsed.data) };
    } catch {
      return { ok: false, error: { code: "retryable", message: "Riwayat peti belum dapat dimuat. Silakan coba lagi." } };
    }
  }

  async recordCrateReturn(raw: unknown, owner: OwnerProfile | null): Promise<AppResult<CrateMovementRecord>> {
    if (!owner) return unauthorizedResult();
    const parsed = crateReturnSchema.safeParse(raw);
    if (!parsed.success) return validationFailure(parsed.error);
    const dateError = validateTransactionDate(parsed.data.occurredAt, this.now());
    if (dateError) return fieldFailure("occurredAt", dateError);
    try {
      const account = await this.repository.getCrateAccount(parsed.data.customerId);
      if (!account) return notFoundFailure("Pelanggan tidak ditemukan.");
      const existing = await this.repository.findCrateMovementByIdempotencyKey(parsed.data.idempotencyKey);
      if (existing) return { ok: true, data: existing };
      const returnError = validateCrateReturn(account.balanceMilli, quantityToMilli(parsed.data.crateQuantity));
      if (returnError) return fieldFailure("crateQuantity", returnError);
      return { ok: true, data: await this.repository.recordCrateReturnAtomic(parsed.data, account.balanceMilli, owner) };
    } catch (error) {
      return this.sanitizedFailure(error, () => this.repository.findCrateMovementByIdempotencyKey(parsed.data.idempotencyKey));
    }
  }

  /* Dua submit paralel dengan kunci sama: yang kalah unique constraint membaca ulang hasil pemenang. */
  private async sanitizedFailure<T>(error: unknown, lookup: () => Promise<T | null>): Promise<AppResult<T>> {
    if (error instanceof RepositoryConflictError) {
      try {
        const existing = await lookup();
        if (existing) return { ok: true, data: existing };
      } catch {
        /* hasil disanitasi di bawah */
      }
    }
    return repositoryFailure(error);
  }
}
