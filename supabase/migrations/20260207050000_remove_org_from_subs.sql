-- Remove organization_id from subordinates
-- User requested to use Normalized approach (derive org from user).

-- 1. Drop dependent policies first to avoid "cannot drop column" error
DROP POLICY IF EXISTS "Users can view organization subordinates" ON "public"."subordinates";
DROP POLICY IF EXISTS "Users can view subordinate tags" ON "public"."subordinate_tags";

-- 2. Drop the column
ALTER TABLE "public"."subordinates" DROP COLUMN "organization_id";

-- 3. Recreate policies with new logic (Normalized)

-- Subordinates: View if you are the owner OR if the owner is in your organization
CREATE POLICY "Users can view organization subordinates" ON "public"."subordinates"
    FOR SELECT USING (
        "user_id" = "auth"."uid"() 
        OR 
        "user_id" IN (
            SELECT "id" FROM "public"."profiles"
            WHERE "organization_id" IN (
                SELECT "organization_id" FROM "public"."profiles" WHERE "id" = "auth"."uid"()
            )
        )
    );

-- Subordinate Tags: View if the subordinate is visible (logic matches above)
CREATE POLICY "Users can view subordinate tags" ON "public"."subordinate_tags"
    FOR SELECT USING (
        "subordinate_id" IN (
            SELECT "id" FROM "public"."subordinates" 
--             Existing logic derived from above, but for RLS performance usually simplified or repeated
            WHERE 
                "user_id" = "auth"."uid"() 
                OR 
                "user_id" IN (
                    SELECT "id" FROM "public"."profiles"
                    WHERE "organization_id" IN (
                        SELECT "organization_id" FROM "public"."profiles" WHERE "id" = "auth"."uid"()
                    )
                )
        )
    );
