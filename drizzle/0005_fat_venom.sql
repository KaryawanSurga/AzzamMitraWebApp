ALTER TABLE "capital_movements" ADD COLUMN "idempotency_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "idempotency_key" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "capital_movements_idempotency_unique" ON "capital_movements" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_idempotency_unique" ON "expenses" USING btree ("idempotency_key");