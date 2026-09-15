CREATE TYPE "public"."adjustment_type" AS ENUM('discount', 'return', 'refund', 'correction', 'cancellation');--> statement-breakpoint
CREATE TYPE "public"."capital_movement_type" AS ENUM('capital_in', 'owner_draw');--> statement-breakpoint
CREATE TYPE "public"."crate_movement_type" AS ENUM('out', 'return', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('unprocessed', 'preparing', 'ready', 'in_transit', 'partially_delivered', 'received', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('egg_purchase', 'delivery', 'fuel_toll_parking', 'loading', 'wages', 'packaging_crates', 'maintenance', 'rent_utilities_operations', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'transfer', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'partial', 'paid', 'due', 'overdue', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."pricing_basis" AS ENUM('crate', 'kg');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('draft', 'confirmed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adjustment_number" text NOT NULL,
	"sale_id" uuid NOT NULL,
	"type" "adjustment_type" NOT NULL,
	"amount_rupiah" bigint DEFAULT 0 NOT NULL,
	"reason" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "adjustments_amount_nonnegative" CHECK ("adjustments"."amount_rupiah" >= 0),
	CONSTRAINT "adjustments_reason_not_blank" CHECK (length(trim("adjustments"."reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_number" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_action_not_blank" CHECK (length(trim("audit_events"."action")) > 0)
);
--> statement-breakpoint
CREATE TABLE "capital_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movement_number" text NOT NULL,
	"type" "capital_movement_type" NOT NULL,
	"amount_rupiah" bigint NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capital_movements_amount_positive" CHECK ("capital_movements"."amount_rupiah" > 0)
);
--> statement-breakpoint
CREATE TABLE "crate_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movement_number" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"sale_id" uuid,
	"delivery_id" uuid,
	"type" "crate_movement_type" NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crate_movements_quantity_positive" CHECK ("crate_movements"."quantity" > 0),
	CONSTRAINT "crate_adjustment_reason_required" CHECK ("crate_movements"."type" <> 'adjustment' or length(trim("crate_movements"."reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_number" text NOT NULL,
	"name" text NOT NULL,
	"whatsapp" text,
	"address" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_name_not_blank" CHECK (length(trim("customers"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_number" text NOT NULL,
	"sale_id" uuid NOT NULL,
	"status" "delivery_status" DEFAULT 'unprocessed' NOT NULL,
	"crate_quantity" numeric(12, 3) NOT NULL,
	"received_crate_quantity" numeric(12, 3) DEFAULT '0' NOT NULL,
	"dispatched_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliveries_quantity_valid" CHECK ("deliveries"."crate_quantity" > 0 and "deliveries"."received_crate_quantity" >= 0 and "deliveries"."received_crate_quantity" <= "deliveries"."crate_quantity")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_number" text NOT NULL,
	"category" "expense_category" NOT NULL,
	"amount_rupiah" bigint NOT NULL,
	"method" "payment_method",
	"occurred_at" timestamp with time zone NOT NULL,
	"notes" text,
	"evidence_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_positive" CHECK ("expenses"."amount_rupiah" > 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_number" text NOT NULL,
	"sale_id" uuid NOT NULL,
	"amount_rupiah" bigint NOT NULL,
	"method" "payment_method" NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"notes" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_rupiah" > 0)
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"description_snapshot" text NOT NULL,
	"pricing_basis" "pricing_basis" NOT NULL,
	"unit_snapshot" text NOT NULL,
	"crate_quantity" numeric(12, 3),
	"weight_kg" numeric(12, 3),
	"pricing_quantity" numeric(12, 3) NOT NULL,
	"unit_price_rupiah" bigint NOT NULL,
	"subtotal_rupiah" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_items_quantities_positive" CHECK ("sale_items"."pricing_quantity" > 0 and ("sale_items"."crate_quantity" is null or "sale_items"."crate_quantity" >= 0) and ("sale_items"."weight_kg" is null or "sale_items"."weight_kg" >= 0)),
	CONSTRAINT "sale_items_amounts_nonnegative" CHECK ("sale_items"."unit_price_rupiah" >= 0 and "sale_items"."subtotal_rupiah" >= 0),
	CONSTRAINT "sale_items_basis_value" CHECK (("sale_items"."pricing_basis" = 'crate' and "sale_items"."crate_quantity" is not null) or ("sale_items"."pricing_basis" = 'kg' and "sale_items"."weight_kg" is not null))
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" "sale_status" DEFAULT 'draft' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"transaction_date" timestamp with time zone NOT NULL,
	"due_date" date,
	"subtotal_rupiah" bigint DEFAULT 0 NOT NULL,
	"discount_rupiah" bigint DEFAULT 0 NOT NULL,
	"fee_rupiah" bigint DEFAULT 0 NOT NULL,
	"total_rupiah" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_amounts_nonnegative" CHECK ("sales"."subtotal_rupiah" >= 0 and "sales"."discount_rupiah" >= 0 and "sales"."fee_rupiah" >= 0 and "sales"."total_rupiah" >= 0),
	CONSTRAINT "sales_total_formula" CHECK ("sales"."total_rupiah" = "sales"."subtotal_rupiah" - "sales"."discount_rupiah" + "sales"."fee_rupiah")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crate_movements" ADD CONSTRAINT "crate_movements_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crate_movements" ADD CONSTRAINT "crate_movements_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crate_movements" ADD CONSTRAINT "crate_movements_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "adjustments_number_unique" ON "adjustments" USING btree ("adjustment_number");--> statement-breakpoint
CREATE INDEX "adjustments_sale_idx" ON "adjustments" USING btree ("sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_events_number_unique" ON "audit_events" USING btree ("event_number");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_events_actor_date_idx" ON "audit_events" USING btree ("actor_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "capital_movements_number_unique" ON "capital_movements" USING btree ("movement_number");--> statement-breakpoint
CREATE INDEX "capital_movements_date_idx" ON "capital_movements" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "crate_movements_number_unique" ON "crate_movements" USING btree ("movement_number");--> statement-breakpoint
CREATE INDEX "crate_movements_customer_date_idx" ON "crate_movements" USING btree ("customer_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_number_unique" ON "customers" USING btree ("customer_number");--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_number_unique" ON "deliveries" USING btree ("delivery_number");--> statement-breakpoint
CREATE INDEX "deliveries_sale_idx" ON "deliveries" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "deliveries_status_idx" ON "deliveries" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_number_unique" ON "expenses" USING btree ("expense_number");--> statement-breakpoint
CREATE INDEX "expenses_date_category_idx" ON "expenses" USING btree ("occurred_at","category");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_number_unique" ON "payments" USING btree ("payment_number");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_idempotency_unique" ON "payments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "payments_sale_idx" ON "payments" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "payments_paid_at_idx" ON "payments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "sale_items_sale_idx" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_invoice_number_unique" ON "sales" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "sales_customer_idx" ON "sales" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "sales_transaction_date_idx" ON "sales" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "sales_status_idx" ON "sales" USING btree ("status","payment_status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");
--> statement-breakpoint
ALTER TABLE "adjustments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "capital_movements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "crate_movements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "deliveries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sale_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sales" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
