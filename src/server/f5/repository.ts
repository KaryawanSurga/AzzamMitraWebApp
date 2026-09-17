import "server-only";
import type {
  CrateOutstandingRecord,
  ReceivableRecord,
  ReportExpenseEvent,
  ReportPaymentEvent,
  ReportSaleEvent,
  UndeliveredRecord,
} from "@/domain/reports";

export { RepositoryUnavailableError } from "@/server/errors";

export interface F5Repository {
  listSales(from: Date, to: Date): Promise<ReportSaleEvent[]>;
  listPayments(from: Date, to: Date): Promise<ReportPaymentEvent[]>;
  listExpenses(from: Date, to: Date): Promise<ReportExpenseEvent[]>;
  listReceivables(asOf: Date): Promise<ReceivableRecord[]>;
  listUndelivered(): Promise<UndeliveredRecord[]>;
  listCrateOutstanding(): Promise<CrateOutstandingRecord[]>;
}
