-- Custom SQL migration file, put your code below! --

-- Ensure the singleton app_setting row exists so invoice-number allocation
-- (ADR-0001) and the digest window always have a row to read/lock. Idempotent.
INSERT INTO "app_setting" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
