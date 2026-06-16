CREATE TABLE "lead" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_date" date NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"brand_id" uuid,
	"license_id" uuid,
	"demo_id" uuid,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_license_id_license_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."license"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_demo_id_demo_id_fk" FOREIGN KEY ("demo_id") REFERENCES "public"."demo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_entry_date_idx" ON "lead" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "lead_brand_idx" ON "lead" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "lead_license_idx" ON "lead" USING btree ("license_id");--> statement-breakpoint
CREATE INDEX "lead_demo_idx" ON "lead" USING btree ("demo_id");