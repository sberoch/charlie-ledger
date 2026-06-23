CREATE TABLE "reminder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"due_on" date NOT NULL,
	"completed_at" timestamp,
	"license_id" uuid,
	"track_id" uuid,
	"brand_id" uuid,
	"demo_id" uuid,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_license_id_license_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."license"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_track_id_track_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."track"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_demo_id_demo_id_fk" FOREIGN KEY ("demo_id") REFERENCES "public"."demo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reminder_due_on_idx" ON "reminder" USING btree ("due_on");--> statement-breakpoint
CREATE INDEX "reminder_completed_at_idx" ON "reminder" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "reminder_license_idx" ON "reminder" USING btree ("license_id");--> statement-breakpoint
CREATE INDEX "reminder_track_idx" ON "reminder" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "reminder_brand_idx" ON "reminder" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "reminder_demo_idx" ON "reminder" USING btree ("demo_id");