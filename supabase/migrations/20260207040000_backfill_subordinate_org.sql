-- Backfill organization_id for existing subordinates
-- This ensures that subordinates created before the organization feature was fully integrated
-- are linked to the same organization as their owner (user).

UPDATE "public"."subordinates" s
SET "organization_id" = p."organization_id"
FROM "public"."profiles" p
WHERE s."user_id" = p."id"
AND s."organization_id" IS NULL
AND p."organization_id" IS NOT NULL;
