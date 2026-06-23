ALTER TABLE "track" DROP CONSTRAINT "track_name_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "track_name_uq" ON "track" USING btree (lower("name"));