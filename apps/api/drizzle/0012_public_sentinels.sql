ALTER TYPE "public"."term_length" ADD VALUE 'one_day' BEFORE 'six_months';--> statement-breakpoint
ALTER TYPE "public"."term_length" ADD VALUE 'one_month' BEFORE 'six_months';--> statement-breakpoint
ALTER TYPE "public"."term_length" ADD VALUE 'six_weeks' BEFORE 'six_months';--> statement-breakpoint
ALTER TYPE "public"."term_length" ADD VALUE 'two_months' BEFORE 'six_months';--> statement-breakpoint
ALTER TYPE "public"."term_length" ADD VALUE 'three_months' BEFORE 'six_months';--> statement-breakpoint
ALTER TYPE "public"."term_length" ADD VALUE 'thirteen_weeks' BEFORE 'six_months';--> statement-breakpoint
ALTER TYPE "public"."term_length" ADD VALUE 'five_years' BEFORE 'perpetual';--> statement-breakpoint
ALTER TYPE "public"."usage_type" ADD VALUE 'all_media';--> statement-breakpoint
ALTER TYPE "public"."usage_type" ADD VALUE 'film_tv';--> statement-breakpoint
ALTER TYPE "public"."usage_type" ADD VALUE 'radio';