import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const auth = pgSchema("auth");
export const authUsers = auth.table("users", { id: uuid("id").primaryKey() });

export const saleStatus = pgEnum("sale_status", ["draft", "confirmed", "completed", "cancelled"]);
export const paymentStatus = pgEnum("payment_status", ["unpaid", "partial", "paid", "due", "overdue", "refunded"]);
export const deliveryStatus = pgEnum("delivery_status", ["unprocessed", "preparing", "ready", "in_transit", "partially_delivered", "received", "failed", "cancelled"]);
export const pricingBasis = pgEnum("pricing_basis", ["crate", "kg"]);
export const paymentMethod = pgEnum("payment_method", ["cash", "transfer", "other"]);
export const crateMovementType = pgEnum("crate_movement_type", ["out", "return", "adjustment"]);
export const expenseCategory = pgEnum("expense_category", ["egg_purchase", "delivery", "fuel_toll_parking", "loading", "wages", "packaging_crates", "maintenance", "rent_utilities_operations", "other"]);
export const capitalMovementType = pgEnum("capital_movement_type", ["capital_in", "owner_draw"]);
export const adjustmentType = pgEnum("adjustment_type", ["discount", "return", "refund", "correction", "cancellation"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().references(() => authUsers.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  ...timestamps,
}, (t) => [uniqueIndex("users_email_unique").on(t.email)]);

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerNumber: text("customer_number").notNull(),
  name: text("name").notNull(),
  whatsapp: text("whatsapp"), address: text("address"), notes: text("notes"),
  ...timestamps,
}, (t) => [uniqueIndex("customers_number_unique").on(t.customerNumber), index("customers_name_idx").on(t.name), check("customers_name_not_blank", sql`length(trim(${t.name})) > 0`)]);

export const sales = pgTable("sales", {
  id: uuid("id").defaultRandom().primaryKey(), invoiceNumber: text("invoice_number").notNull(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
  status: saleStatus("status").default("draft").notNull(), paymentStatus: paymentStatus("payment_status").default("unpaid").notNull(),
  transactionDate: timestamp("transaction_date", { withTimezone: true }).notNull(), dueDate: date("due_date"),
  subtotalRupiah: bigint("subtotal_rupiah", { mode: "number" }).default(0).notNull(), discountRupiah: bigint("discount_rupiah", { mode: "number" }).default(0).notNull(),
  feeRupiah: bigint("fee_rupiah", { mode: "number" }).default(0).notNull(), totalRupiah: bigint("total_rupiah", { mode: "number" }).default(0).notNull(),
  notes: text("notes"), confirmedAt: timestamp("confirmed_at", { withTimezone: true }), cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [uniqueIndex("sales_invoice_number_unique").on(t.invoiceNumber), index("sales_customer_idx").on(t.customerId), index("sales_transaction_date_idx").on(t.transactionDate), index("sales_status_idx").on(t.status, t.paymentStatus), check("sales_amounts_nonnegative", sql`${t.subtotalRupiah} >= 0 and ${t.discountRupiah} >= 0 and ${t.feeRupiah} >= 0 and ${t.totalRupiah} >= 0`), check("sales_total_formula", sql`${t.totalRupiah} = ${t.subtotalRupiah} - ${t.discountRupiah} + ${t.feeRupiah}`)]);

export const saleItems = pgTable("sale_items", {
  id: uuid("id").defaultRandom().primaryKey(), saleId: uuid("sale_id").notNull().references(() => sales.id, { onDelete: "restrict" }),
  descriptionSnapshot: text("description_snapshot").notNull(), pricingBasis: pricingBasis("pricing_basis").notNull(), unitSnapshot: text("unit_snapshot").notNull(),
  crateQuantity: numeric("crate_quantity", { precision: 12, scale: 3 }), weightKg: numeric("weight_kg", { precision: 12, scale: 3 }),
  pricingQuantity: numeric("pricing_quantity", { precision: 12, scale: 3 }).notNull(), unitPriceRupiah: bigint("unit_price_rupiah", { mode: "number" }).notNull(), subtotalRupiah: bigint("subtotal_rupiah", { mode: "number" }).notNull(),
  createdAt: timestamps.createdAt,
}, (t) => [index("sale_items_sale_idx").on(t.saleId), check("sale_items_quantities_positive", sql`${t.pricingQuantity} > 0 and (${t.crateQuantity} is null or ${t.crateQuantity} >= 0) and (${t.weightKg} is null or ${t.weightKg} >= 0)`), check("sale_items_amounts_nonnegative", sql`${t.unitPriceRupiah} >= 0 and ${t.subtotalRupiah} >= 0`), check("sale_items_basis_value", sql`(${t.pricingBasis} = 'crate' and ${t.crateQuantity} is not null) or (${t.pricingBasis} = 'kg' and ${t.weightKg} is not null)`)]);

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(), paymentNumber: text("payment_number").notNull(), saleId: uuid("sale_id").notNull().references(() => sales.id, { onDelete: "restrict" }),
  amountRupiah: bigint("amount_rupiah", { mode: "number" }).notNull(), method: paymentMethod("method").notNull(), paidAt: timestamp("paid_at", { withTimezone: true }).notNull(), notes: text("notes"), idempotencyKey: text("idempotency_key").notNull(), createdAt: timestamps.createdAt,
}, (t) => [uniqueIndex("payments_number_unique").on(t.paymentNumber), uniqueIndex("payments_idempotency_unique").on(t.idempotencyKey), index("payments_sale_idx").on(t.saleId), index("payments_paid_at_idx").on(t.paidAt), check("payments_amount_positive", sql`${t.amountRupiah} > 0`)]);

export const deliveries = pgTable("deliveries", {
  id: uuid("id").defaultRandom().primaryKey(), deliveryNumber: text("delivery_number").notNull(), saleId: uuid("sale_id").notNull().references(() => sales.id, { onDelete: "restrict" }), status: deliveryStatus("status").default("unprocessed").notNull(),
  crateQuantity: numeric("crate_quantity", { precision: 12, scale: 3 }).notNull(), receivedCrateQuantity: numeric("received_crate_quantity", { precision: 12, scale: 3 }).default("0").notNull(), dispatchedAt: timestamp("dispatched_at", { withTimezone: true }), receivedAt: timestamp("received_at", { withTimezone: true }), notes: text("notes"), ...timestamps,
}, (t) => [uniqueIndex("deliveries_number_unique").on(t.deliveryNumber), index("deliveries_sale_idx").on(t.saleId), index("deliveries_status_idx").on(t.status), check("deliveries_quantity_valid", sql`${t.crateQuantity} > 0 and ${t.receivedCrateQuantity} >= 0 and ${t.receivedCrateQuantity} <= ${t.crateQuantity}`)]);

export const crateMovements = pgTable("crate_movements", {
  id: uuid("id").defaultRandom().primaryKey(), movementNumber: text("movement_number").notNull(), customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }), saleId: uuid("sale_id").references(() => sales.id, { onDelete: "restrict" }), deliveryId: uuid("delivery_id").references(() => deliveries.id, { onDelete: "restrict" }), type: crateMovementType("type").notNull(), quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(), occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(), reason: text("reason"), createdAt: timestamps.createdAt,
}, (t) => [uniqueIndex("crate_movements_number_unique").on(t.movementNumber), index("crate_movements_customer_date_idx").on(t.customerId, t.occurredAt), check("crate_movements_quantity_positive", sql`${t.quantity} > 0`), check("crate_adjustment_reason_required", sql`${t.type} <> 'adjustment' or length(trim(${t.reason})) > 0`)]);

export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(), expenseNumber: text("expense_number").notNull(), category: expenseCategory("category").notNull(), amountRupiah: bigint("amount_rupiah", { mode: "number" }).notNull(), method: paymentMethod("method"), occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(), notes: text("notes"), evidencePath: text("evidence_path"), ...timestamps,
}, (t) => [uniqueIndex("expenses_number_unique").on(t.expenseNumber), index("expenses_date_category_idx").on(t.occurredAt, t.category), check("expenses_amount_positive", sql`${t.amountRupiah} > 0`)]);

export const capitalMovements = pgTable("capital_movements", {
  id: uuid("id").defaultRandom().primaryKey(), movementNumber: text("movement_number").notNull(), type: capitalMovementType("type").notNull(), amountRupiah: bigint("amount_rupiah", { mode: "number" }).notNull(), occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(), notes: text("notes"), ...timestamps,
}, (t) => [uniqueIndex("capital_movements_number_unique").on(t.movementNumber), index("capital_movements_date_idx").on(t.occurredAt), check("capital_movements_amount_positive", sql`${t.amountRupiah} > 0`)]);

export const adjustments = pgTable("adjustments", {
  id: uuid("id").defaultRandom().primaryKey(), adjustmentNumber: text("adjustment_number").notNull(), saleId: uuid("sale_id").notNull().references(() => sales.id, { onDelete: "restrict" }), type: adjustmentType("type").notNull(), amountRupiah: bigint("amount_rupiah", { mode: "number" }).default(0).notNull(), reason: text("reason").notNull(), occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(), createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamps.createdAt,
}, (t) => [uniqueIndex("adjustments_number_unique").on(t.adjustmentNumber), index("adjustments_sale_idx").on(t.saleId), check("adjustments_amount_nonnegative", sql`${t.amountRupiah} >= 0`), check("adjustments_reason_not_blank", sql`length(trim(${t.reason})) > 0`)]);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(), eventNumber: text("event_number").notNull(), actorId: uuid("actor_id").notNull().references(() => users.id, { onDelete: "restrict" }), entityType: text("entity_type").notNull(), entityId: uuid("entity_id").notNull(), action: text("action").notNull(), before: jsonb("before"), after: jsonb("after"), reason: text("reason"), occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("audit_events_number_unique").on(t.eventNumber), index("audit_events_entity_idx").on(t.entityType, t.entityId), index("audit_events_actor_date_idx").on(t.actorId, t.occurredAt), check("audit_events_action_not_blank", sql`length(trim(${t.action})) > 0`)]);
