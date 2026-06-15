CREATE TABLE "brand_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "invoice_license_idx";--> statement-breakpoint
DROP INDEX "invoice_demo_idx";--> statement-breakpoint
ALTER TABLE "brand" ADD COLUMN "category_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_category" ADD CONSTRAINT "brand_category_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_category_name_uq" ON "brand_category" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "brand" ADD CONSTRAINT "brand_category_id_brand_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."brand_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_name_uq" ON "brand" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "brand_category_idx" ON "brand" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payer_name_uq" ON "payer" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_license_live_uq" ON "invoice" USING btree ("license_id") WHERE "invoice"."voided_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_demo_live_uq" ON "invoice" USING btree ("demo_id") WHERE "invoice"."voided_at" IS NULL;--> statement-breakpoint
CREATE INDEX "invoice_license_idx" ON "invoice" USING btree ("license_id");--> statement-breakpoint
CREATE INDEX "invoice_demo_idx" ON "invoice" USING btree ("demo_id");