-- Drop Role and Department columns from Subordinates table
ALTER TABLE "public"."subordinates" 
DROP COLUMN IF EXISTS "role",
DROP COLUMN IF EXISTS "department";
