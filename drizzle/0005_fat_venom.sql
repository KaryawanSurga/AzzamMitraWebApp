ALTER TABLE "capital_movements" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
UPDATE "capital_movements" SET "idempotency_key" = 'legacy:' || "id"::text WHERE "idempotency_key" IS NULL;--> statement-breakpoint
UPDATE "expenses" SET "idempotency_key" = 'legacy:' || "id"::text WHERE "idempotency_key" IS NULL;--> statement-breakpoint
ALTER TABLE "capital_movements" ALTER COLUMN "idempotency_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "idempotency_key" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "capital_movements_idempotency_unique" ON "capital_movements" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_idempotency_unique" ON "expenses" USING btree ("idempotency_key");
