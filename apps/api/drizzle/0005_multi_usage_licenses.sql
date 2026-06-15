-- A License now grants one or more Usage Types (ADR-0004). Convert the scalar
-- `usage_type` column to a `usage_type[]` array, wrapping each existing single
-- value into a one-element set so no data is lost. (drizzle-kit's default
-- `::text::usage_type[]` cast is replaced — it would try to parse the scalar
-- value as an array literal and fail on every existing row.)
ALTER TABLE "license" ALTER COLUMN "usage_type" SET DATA TYPE "public"."usage_type"[] USING ARRAY["usage_type"]::"public"."usage_type"[];
