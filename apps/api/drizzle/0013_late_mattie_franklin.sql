CREATE TABLE "royalty_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_date" date NOT NULL,
	"payer_id" uuid NOT NULL,
	"description" text,
	"amount" numeric(12, 2) NOT NULL,
	"brand_id" uuid,
	"track_id" uuid,
	"license_id" uuid,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "royalty_payment" ADD CONSTRAINT "royalty_payment_payer_id_payer_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."payer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "royalty_payment" ADD CONSTRAINT "royalty_payment_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "royalty_payment" ADD CONSTRAINT "royalty_payment_track_id_track_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."track"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "royalty_payment" ADD CONSTRAINT "royalty_payment_license_id_license_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."license"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "royalty_payment" ADD CONSTRAINT "royalty_payment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "royalty_payment_date_idx" ON "royalty_payment" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "royalty_payment_payer_idx" ON "royalty_payment" USING btree ("payer_id");--> statement-breakpoint
CREATE INDEX "royalty_payment_brand_idx" ON "royalty_payment" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "royalty_payment_track_idx" ON "royalty_payment" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "royalty_payment_license_idx" ON "royalty_payment" USING btree ("license_id");