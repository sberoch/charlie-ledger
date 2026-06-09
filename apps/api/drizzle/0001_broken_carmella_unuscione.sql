CREATE TYPE "public"."demo_status" AS ENUM('open', 'converted');--> statement-breakpoint
CREATE TYPE "public"."exclusivity_tier" AS ENUM('non_exclusive', 'category_exclusive', 'full_exclusive', 'work_for_hire');--> statement-breakpoint
CREATE TYPE "public"."hold_period" AS ENUM('none', 'three_months', 'six_months');--> statement-breakpoint
CREATE TYPE "public"."term_length" AS ENUM('six_months', 'one_year', 'two_years', 'three_years', 'perpetual');--> statement-breakpoint
CREATE TYPE "public"."track_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."usage_type" AS ENUM('broadcast', 'digital_media', 'social_media', 'internet', 'internal');--> statement-breakpoint
CREATE TABLE "app_setting" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"next_invoice_number" integer DEFAULT 1 NOT NULL,
	"digest_lookahead_days" integer DEFAULT 7 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_setting_singleton" CHECK ("app_setting"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "brand" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"payer_id" uuid NOT NULL,
	"fee" numeric(12, 2) NOT NULL,
	"working_name" text NOT NULL,
	"hold_period" "hold_period" NOT NULL,
	"written_at" date NOT NULL,
	"hold_ends_at" date NOT NULL,
	"status" "demo_status" DEFAULT 'open' NOT NULL,
	"converted_track_id" uuid,
	"notes" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"address" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"disco_id" text NOT NULL,
	"name" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "track_status" DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "track_disco_id_unique" UNIQUE("disco_id")
);
--> statement-breakpoint
CREATE TABLE "license" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"payer_id" uuid NOT NULL,
	"usage_type" "usage_type" NOT NULL,
	"exclusivity_tier" "exclusivity_tier" NOT NULL,
	"term_length" "term_length" NOT NULL,
	"fee" numeric(12, 2) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"renewed_to_id" uuid,
	"notes" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer NOT NULL,
	"license_id" uuid,
	"demo_id" uuid,
	"bill_to_name" text NOT NULL,
	"bill_to_email" text,
	"bill_to_address" text,
	"amount" numeric(12, 2) NOT NULL,
	"description" text NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"paid_date" date,
	"voided_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_number_unique" UNIQUE("number"),
	CONSTRAINT "invoice_exactly_one_source" CHECK (num_nonnulls("invoice"."license_id", "invoice"."demo_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "brand" ADD CONSTRAINT "brand_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo" ADD CONSTRAINT "demo_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo" ADD CONSTRAINT "demo_payer_id_payer_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."payer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo" ADD CONSTRAINT "demo_converted_track_id_track_id_fk" FOREIGN KEY ("converted_track_id") REFERENCES "public"."track"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo" ADD CONSTRAINT "demo_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payer" ADD CONSTRAINT "payer_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license" ADD CONSTRAINT "license_track_id_track_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."track"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license" ADD CONSTRAINT "license_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license" ADD CONSTRAINT "license_payer_id_payer_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."payer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license" ADD CONSTRAINT "license_renewed_to_id_license_id_fk" FOREIGN KEY ("renewed_to_id") REFERENCES "public"."license"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license" ADD CONSTRAINT "license_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_license_id_license_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."license"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_demo_id_demo_id_fk" FOREIGN KEY ("demo_id") REFERENCES "public"."demo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "demo_brand_idx" ON "demo" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "demo_payer_idx" ON "demo" USING btree ("payer_id");--> statement-breakpoint
CREATE INDEX "demo_converted_track_idx" ON "demo" USING btree ("converted_track_id");--> statement-breakpoint
CREATE INDEX "demo_hold_ends_at_idx" ON "demo" USING btree ("hold_ends_at");--> statement-breakpoint
CREATE INDEX "track_tags_gin_idx" ON "track" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "license_track_idx" ON "license" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "license_brand_idx" ON "license" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "license_payer_idx" ON "license" USING btree ("payer_id");--> statement-breakpoint
CREATE INDEX "license_end_date_idx" ON "license" USING btree ("end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_license_idx" ON "invoice" USING btree ("license_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_demo_idx" ON "invoice" USING btree ("demo_id");--> statement-breakpoint
CREATE INDEX "invoice_due_date_idx" ON "invoice" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "invoice_paid_date_idx" ON "invoice" USING btree ("paid_date");