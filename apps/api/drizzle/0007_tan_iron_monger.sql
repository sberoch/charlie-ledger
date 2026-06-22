CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_tag" (
	"track_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "track_tag_track_id_tag_id_pk" PRIMARY KEY("track_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "track" DROP CONSTRAINT "track_disco_id_unique";--> statement-breakpoint
DROP INDEX "track_tags_gin_idx";--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_tag" ADD CONSTRAINT "track_tag_track_id_track_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."track"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_tag" ADD CONSTRAINT "track_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tag_name_uq" ON "tag" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "track" DROP COLUMN "disco_id";--> statement-breakpoint
ALTER TABLE "track" DROP COLUMN "tags";--> statement-breakpoint
ALTER TABLE "track" DROP COLUMN "last_synced_at";--> statement-breakpoint
ALTER TABLE "track" ADD CONSTRAINT "track_name_unique" UNIQUE("name");