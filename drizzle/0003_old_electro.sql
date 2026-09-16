ALTER TABLE "audit_events" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "create_idempotency_key" text;--> statement-breakpoint
UPDATE "customers" SET "create_idempotency_key" = 'legacy:' || "id"::text WHERE "create_idempotency_key" IS NULL;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "create_idempotency_key" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "audit_events_idempotency_unique" ON "audit_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_create_idempotency_unique" ON "customers" USING btree ("create_idempotency_key");
