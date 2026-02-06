-- Add Organizations table
CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL, -- For inviting users
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "organizations_code_key" UNIQUE ("code")
);

ALTER TABLE "public"."organizations" OWNER TO "postgres";
ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;

-- Update profiles table
ALTER TABLE "public"."profiles" 
ADD COLUMN IF NOT EXISTS "organization_id" "uuid" REFERENCES "public"."organizations"("id") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "organization_role" "text" DEFAULT 'member' CHECK ("organization_role" IN ('member', 'admin'));

CREATE INDEX IF NOT EXISTS "idx_profiles_organization_id" ON "public"."profiles" USING "btree" ("organization_id");

-- Community: Posts
CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "title" "text",
    "content" "text" NOT NULL,
    "category" "text", -- e.g., 'feedback', 'insight', 'question'
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."posts" OWNER TO "postgres";
ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER "update_posts_updated_at" BEFORE UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- Community: Comments
CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL REFERENCES "public"."posts"("id") ON DELETE CASCADE,
    "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."comments" OWNER TO "postgres";
ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER "update_comments_updated_at" BEFORE UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- Community: Likes
CREATE TABLE IF NOT EXISTS "public"."likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "post_id" "uuid" REFERENCES "public"."posts"("id") ON DELETE CASCADE,
    "comment_id" "uuid" REFERENCES "public"."comments"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "likes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "likes_target_check" CHECK (
        ("post_id" IS NOT NULL AND "comment_id" IS NULL) OR
        ("post_id" IS NULL AND "comment_id" IS NOT NULL)
    ),
    CONSTRAINT "likes_post_unique" UNIQUE ("user_id", "post_id"),
    CONSTRAINT "likes_comment_unique" UNIQUE ("user_id", "comment_id")
);

ALTER TABLE "public"."likes" OWNER TO "postgres";
ALTER TABLE "public"."likes" ENABLE ROW LEVEL SECURITY;

-- Analytics: Summaries (Placeholder for now)
CREATE TABLE IF NOT EXISTS "public"."analytics_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "department" "text", -- Optional breakdown
    "metrics" "jsonb" DEFAULT '{}'::"jsonb", -- { "turnover_risk": 0.5, "sentiment_avg": 7.2 }
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "analytics_summaries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."analytics_summaries" OWNER TO "postgres";
ALTER TABLE "public"."analytics_summaries" ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view organizations they belong to
CREATE POLICY "Users can view own organization" ON "public"."organizations"
    FOR SELECT USING (
        "id" IN (SELECT "organization_id" FROM "public"."profiles" WHERE "id" = "auth"."uid"())
    );

-- Any authenticated user can create an organization (for now)
CREATE POLICY "Authenticated users can create organizations" ON "public"."organizations"
    FOR INSERT WITH CHECK ("auth"."role"() = 'authenticated');

-- Posts are visible to everyone authenticated (Global Community)
CREATE POLICY "Posts are visible to authenticated users" ON "public"."posts"
    FOR SELECT USING ("auth"."role"() = 'authenticated');

CREATE POLICY "Users can create posts" ON "public"."posts"
    FOR INSERT WITH CHECK ("auth"."uid"() = "user_id");

CREATE POLICY "Users can update own posts" ON "public"."posts"
    FOR UPDATE USING ("auth"."uid"() = "user_id");

CREATE POLICY "Users can delete own posts" ON "public"."posts"
    FOR DELETE USING ("auth"."uid"() = "user_id");

-- Comments
CREATE POLICY "Comments are visible to authenticated users" ON "public"."comments"
    FOR SELECT USING ("auth"."role"() = 'authenticated');

CREATE POLICY "Users can create comments" ON "public"."comments"
    FOR INSERT WITH CHECK ("auth"."uid"() = "user_id");

-- Likes
CREATE POLICY "Likes are visible to authenticated users" ON "public"."likes"
    FOR SELECT USING ("auth"."role"() = 'authenticated');

CREATE POLICY "Users can toggle likes" ON "public"."likes"
    FOR ALL USING ("auth"."uid"() = "user_id");

-- Analytics: Only organization admins can view
CREATE POLICY "Admins can view organization analytics" ON "public"."analytics_summaries"
    FOR SELECT USING (
        "organization_id" IN (
            SELECT "organization_id" 
            FROM "public"."profiles" 
            WHERE "id" = "auth"."uid"() AND "organization_role" = 'admin'
        )
    );

-- Permissions
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";

GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";

GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";

GRANT ALL ON TABLE "public"."likes" TO "authenticated";
GRANT ALL ON TABLE "public"."likes" TO "service_role";

GRANT ALL ON TABLE "public"."analytics_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_summaries" TO "service_role";
