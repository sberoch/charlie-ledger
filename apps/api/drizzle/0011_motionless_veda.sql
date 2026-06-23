CREATE TYPE "public"."reminder_kind" AS ENUM('broadcast_royalty', 'license_renewal');--> statement-breakpoint
-- Add nullable, backfill existing rows (the broadcast-royalty rule was the only
-- one to ever create a reminder), then enforce NOT NULL.
ALTER TABLE "reminder" ADD COLUMN "reminder_kind" "reminder_kind";--> statement-breakpoint
UPDATE "reminder" SET "reminder_kind" = 'broadcast_royalty' WHERE "reminder_kind" IS NULL;--> statement-breakpoint
ALTER TABLE "reminder" ALTER COLUMN "reminder_kind" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "reminder_license_kind_idx" ON "reminder" USING btree ("license_id","reminder_kind");