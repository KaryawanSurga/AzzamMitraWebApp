ALTER TABLE "crate_movements" ADD COLUMN "idempotency_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "idempotency_key" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "crate_movements_idempotency_unique" ON "crate_movements" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_idempotency_unique" ON "deliveries" USING btree ("idempotency_key");