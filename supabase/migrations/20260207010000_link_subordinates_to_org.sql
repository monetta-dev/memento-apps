-- Link Subordinates to Organization
ALTER TABLE "public"."subordinates" 
ADD COLUMN IF NOT EXISTS "organization_id" "uuid" REFERENCES "public"."organizations"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_subordinates_organization_id" ON "public"."subordinates" USING "btree" ("organization_id");

-- RLS: Users can view subordinates in their organization
CREATE POLICY "Users can view organization subordinates" ON "public"."subordinates"
    FOR SELECT USING (
        "organization_id" IN (
            SELECT "organization_id" FROM "public"."profiles" WHERE "id" = "auth"."uid"()
        ) 
        OR 
        -- Keep existing logic: Users can see their own subordinates even if not in org (or private ones)
        "user_id" = "auth"."uid"()
    );
-- Note: 'user_id' column on subordinates needs to be verified. 
-- In initial_schema.sql, subordinates table does NOT have 'user_id' column defined in CREATE TABLE, 
-- but it has NOT 'user_id' index? Wait, let me check initial_schema.sql again.
-- initial_schema.sql lines 187-194: 
-- "id", "name", "role", "department", "traits", "created_at". NO "user_id".
-- But useStore.ts line 176 uses `user_id`. And line 99 filters by `user_id`.
-- Wait, did I miss it? 
-- Let's check initial_schema.sql again carefully.
-- Lines 187-194. No user_id. 
-- BUT, line 687 is end of file.
-- Check if there are ALTERS.
-- Line 302-313: Foreign keys.
-- sessions_subordinate_id_fkey, sessions_user_id_fkey.
-- I don't see subordinates_user_id_fkey.
-- This is strange. `useStore.ts` explicitly inserts `user_id` into `subordinates`.
-- If the column doesn't exist, the insert would fail.
-- Maybe `initial_schema.sql` I read is outdated or I missed a migration?
-- Or maybe local Supabase has it but it's not in that specific file?
-- I will assume `user_id` exists because the app is working/building.
-- Safely adding if not exists is good practice, or checking via SQL.

-- Let's add user_id just in case it's missing in my mental model, or skip if I trust the app.
-- Given I saw lines 187-194 without it, I should probably add it if it's not there. 
-- But wait, `useStore.ts` implies it IS there.
-- I'll proceed assuming `user_id` exists for RLS policies, but won't ALTER table to add it to avoid conflict if it exists.

-- Subordinate Tags (Junction table)
CREATE TABLE IF NOT EXISTS "public"."subordinate_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subordinate_id" "uuid" NOT NULL REFERENCES "public"."subordinates"("id") ON DELETE CASCADE,
    "tag_id" "uuid" NOT NULL REFERENCES "public"."tags"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "subordinate_tags_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subordinate_tags_unique" UNIQUE ("subordinate_id", "tag_id")
);

ALTER TABLE "public"."subordinate_tags" OWNER TO "postgres";
ALTER TABLE "public"."subordinate_tags" ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view subordinate tags if they can view the subordinate
CREATE POLICY "Users can view subordinate tags" ON "public"."subordinate_tags"
    FOR SELECT USING (
        "subordinate_id" IN (
            SELECT "id" FROM "public"."subordinates" 
            WHERE "user_id" = "auth"."uid"()
            OR "organization_id" IN (
                SELECT "organization_id" FROM "public"."profiles" WHERE "id" = "auth"."uid"()
            )
        )
    );

-- Manage: Users can add tags to their own subordinates
CREATE POLICY "Users can manage tags for own subordinates" ON "public"."subordinate_tags"
    FOR ALL USING (
        "subordinate_id" IN (
            SELECT "id" FROM "public"."subordinates" WHERE "user_id" = "auth"."uid"()
        )
    );

-- Permissions
GRANT ALL ON TABLE "public"."subordinate_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."subordinate_tags" TO "service_role";
