CREATE TABLE "album" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "track" ADD COLUMN "album_id" uuid;--> statement-breakpoint
ALTER TABLE "album" ADD CONSTRAINT "album_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "album_name_uq" ON "album" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "track" ADD CONSTRAINT "track_album_id_album_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."album"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "track_album_idx" ON "track" USING btree ("album_id");