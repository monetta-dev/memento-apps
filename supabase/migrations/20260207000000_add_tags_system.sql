-- Add Tags table
CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#2db7f5', -- Default blue-ish color
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tags_org_name_key" UNIQUE ("organization_id", "name")
);

ALTER TABLE "public"."tags" OWNER TO "postgres";
ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;

-- Add Profile Tags (Junction table)
CREATE TABLE IF NOT EXISTS "public"."profile_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "tag_id" "uuid" NOT NULL REFERENCES "public"."tags"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "profile_tags_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "profile_tags_unique" UNIQUE ("profile_id", "tag_id")
);

ALTER TABLE "public"."profile_tags" OWNER TO "postgres";
ALTER TABLE "public"."profile_tags" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Tags

-- View: Authenticated users can view tags in their organization
CREATE POLICY "Users can view organization tags" ON "public"."tags"
    FOR SELECT USING (
        "organization_id" IN (
            SELECT "organization_id" FROM "public"."profiles" WHERE "id" = "auth"."uid"()
        )
    );

-- Create/Edit/Delete: Only Admins can manage tags
CREATE POLICY "Admins can manage tags" ON "public"."tags"
    FOR ALL USING (
        "organization_id" IN (
            SELECT "organization_id" 
            FROM "public"."profiles" 
            WHERE "id" = "auth"."uid"() AND "organization_role" = 'admin'
        )
    );

-- RLS Policies for Profile Tags

-- View: Authenticated users can view profile tags in their organization
CREATE POLICY "Users can view profile tags" ON "public"."profile_tags"
    FOR SELECT USING (
        "tag_id" IN (
            SELECT "id" FROM "public"."tags" WHERE "organization_id" IN (
                  SELECT "organization_id" FROM "public"."profiles" WHERE "id" = "auth"."uid"()
            )
        )
    );

-- Manage: Only Admins can assign/remove tags to profiles
CREATE POLICY "Admins can manage profile tags" ON "public"."profile_tags"
    FOR ALL USING (
         EXISTS (
            SELECT 1 FROM "public"."tags"
            WHERE "tags"."id" = "profile_tags"."tag_id"
            AND "tags"."organization_id" IN (
                SELECT "organization_id" 
                FROM "public"."profiles" 
                WHERE "id" = "auth"."uid"() AND "organization_role" = 'admin'
            )
        )
    );

-- Permissions
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";

GRANT ALL ON TABLE "public"."profile_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_tags" TO "service_role";
