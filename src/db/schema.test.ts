import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

describe("schema data inti", () => {
  it("mendefinisikan seluruh sebelas tabel aplikasi", () => { const tables = [schema.users, schema.customers, schema.sales, schema.saleItems, schema.payments, schema.deliveries, schema.crateMovements, schema.expenses, schema.capitalMovements, schema.adjustments, schema.auditEvents]; expect(tables.map((table) => getTableConfig(table).name)).toEqual(["users", "customers", "sales", "sale_items", "payments", "deliveries", "crate_movements", "expenses", "capital_movements", "adjustments", "audit_events"]); });
  it("memiliki constraint uang, kuantitas, total, dan alasan koreksi", () => { const names = [schema.sales, schema.saleItems, schema.payments, schema.deliveries, schema.adjustments].flatMap((table) => getTableConfig(table).checks.map((item) => item.name)); expect(names).toEqual(expect.arrayContaining(["sales_total_formula", "sales_amounts_nonnegative", "sale_items_quantities_positive", "payments_amount_positive", "deliveries_quantity_valid", "adjustments_reason_not_blank"])); });
  it("menetapkan nomor tampilan unik dan index relasi penting", () => { expect(getTableConfig(schema.sales).indexes.map((item) => item.config.name)).toEqual(expect.arrayContaining(["sales_invoice_number_unique", "sales_customer_idx"])); expect(getTableConfig(schema.payments).indexes.map((item) => item.config.name)).toEqual(expect.arrayContaining(["payments_number_unique", "payments_idempotency_unique", "payments_sale_idx"])); });
});
