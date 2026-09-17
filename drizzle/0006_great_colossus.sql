ALTER TABLE "adjustments" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
UPDATE "adjustments" SET "idempotency_key" = 'legacy:' || "id"::text WHERE "idempotency_key" IS NULL;--> statement-breakpoint
ALTER TABLE "adjustments" ALTER COLUMN "idempotency_key" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "adjustments_idempotency_unique" ON "adjustments" USING btree ("idempotency_key");
