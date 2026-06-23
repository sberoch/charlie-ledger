ALTER TABLE "lead" ADD COLUMN "track_id" uuid;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_track_id_track_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."track"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_track_idx" ON "lead" USING btree ("track_id");