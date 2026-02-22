


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."create_organization_and_link"("org_name" "text", "org_code" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    "new_org_id" "uuid";
    "new_org_data" "jsonb";
    "current_user_id" "uuid";
BEGIN
    -- Get current user
    "current_user_id" := auth.uid();
    IF "current_user_id" IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check if user already has an org? Optional.
    
    -- Insert Organization
    INSERT INTO "public"."organizations" ("name", "code")
    VALUES ("org_name", "org_code")
    RETURNING "id" INTO "new_org_id";

    -- Query back the data (as system)
    SELECT row_to_json("organizations") INTO "new_org_data"
    FROM "public"."organizations" WHERE "id" = "new_org_id";

    -- Link Profile
    UPDATE "public"."profiles"
    SET "organization_id" = "new_org_id",
        "organization_role" = 'admin'
    WHERE "id" = "current_user_id";

    RETURN "new_org_data";
END;
$$;


ALTER FUNCTION "public"."create_organization_and_link"("org_name" "text", "org_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_org_dashboard_stats"("p_org_id" "uuid", "p_tag_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_total_subordinates integer;
    v_risk_count integer;
    v_sentiment numeric;
    v_one_on_one_rate numeric;
    v_user_ids uuid[];
    v_subordinate_ids uuid[];
BEGIN
    -- Auth Check
    IF NOT EXISTS (
        SELECT 1 FROM "public"."profiles" 
        WHERE "id" = auth.uid() AND "organization_id" = p_org_id
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Get all user IDs in the organization
    SELECT array_agg(id) INTO v_user_ids
    FROM "public"."profiles"
    WHERE "organization_id" = p_org_id;

    IF v_user_ids IS NULL THEN
        RETURN jsonb_build_object('totalSubordinates', 0, 'riskCount', 0, 'sentiment', 0, 'oneOnOneRate', 0);
    END IF;

    -- Get Subordinate IDs (Filtered by Tag if provided)
    SELECT array_agg(s.id) INTO v_subordinate_ids
    FROM "public"."subordinates" s
    LEFT JOIN "public"."subordinate_tags" st ON s.id = st.subordinate_id
    WHERE s.user_id = ANY(v_user_ids)
    -- Tag Filter Logic
    AND (p_tag_id IS NULL OR st.tag_id = p_tag_id);

    -- If no subordinates found after filter
    IF v_subordinate_ids IS NULL THEN
        RETURN jsonb_build_object('totalSubordinates', 0, 'riskCount', 0, 'sentiment', 0, 'oneOnOneRate', 0);
    END IF;

    -- 1. Total Subordinates
    -- Use DISTINCT because a subordinate might have multiple tags (if we were joining differently), 
    -- but here array_agg on IDs is safe if we handle distinctness or the join logic correctly.
    -- With Left Join on tags, if a sub has 2 tags and we filter by one, it appears once. 
    -- If p_tag_id is NULL, we might get duplicates if we just joined. 
    -- Let's refine the query above to be distinct or use EXISTS.
    
    -- Refined Subordinate ID fetching to avoid duplicates when p_tag_id is NULL
    IF p_tag_id IS NULL THEN
        SELECT array_agg(id) INTO v_subordinate_ids FROM "public"."subordinates" WHERE user_id = ANY(v_user_ids);
    ELSE
         SELECT array_agg(DISTINCT s.id) INTO v_subordinate_ids
         FROM "public"."subordinates" s
         JOIN "public"."subordinate_tags" st ON s.id = st.subordinate_id
         WHERE s.user_id = ANY(v_user_ids) AND st.tag_id = p_tag_id;
    END IF;
    
    IF v_subordinate_ids IS NULL THEN
         RETURN jsonb_build_object('totalSubordinates', 0, 'riskCount', 0, 'sentiment', 0, 'oneOnOneRate', 0);
    END IF;

    v_total_subordinates := array_length(v_subordinate_ids, 1);

    -- 2. Risk Count
    SELECT COUNT(*) INTO v_risk_count
    FROM "public"."subordinates" s
    WHERE s.id = ANY(v_subordinate_ids)
    AND EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(s.traits) t
        WHERE t IN ('anxious', 'worried', 'struggling', '不安', '不満')
    );

    -- 3. Sentiment (avg of sessions in last 3 months)
    SELECT ROUND(AVG(sentiment_score), 1) INTO v_sentiment
    FROM "public"."sessions"
    WHERE subordinate_id = ANY(v_subordinate_ids)
    AND date >= (NOW() - INTERVAL '3 months')
    AND sentiment_score IS NOT NULL;

    -- 4. One on One Rate (Active subordinates in last month / Total)
    -- Definition: % of subordinates who had a session in the last 30 days
    DECLARE
        v_active_subs integer;
    BEGIN
        SELECT COUNT(DISTINCT subordinate_id) INTO v_active_subs
        FROM "public"."sessions"
        WHERE subordinate_id = ANY(v_subordinate_ids)
        AND date >= (NOW() - INTERVAL '30 days');
        
        IF v_total_subordinates > 0 THEN
            v_one_on_one_rate := ROUND((v_active_subs::numeric / v_total_subordinates::numeric) * 100, 1);
        ELSE
            v_one_on_one_rate := 0;
        END IF;
    END;

    RETURN jsonb_build_object(
        'totalSubordinates', v_total_subordinates,
        'riskCount', v_risk_count,
        'sentiment', COALESCE(v_sentiment, 0),
        'oneOnOneRate', v_one_on_one_rate
    );
END;
$$;


ALTER FUNCTION "public"."get_org_dashboard_stats"("p_org_id" "uuid", "p_tag_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_org_sentiment_trend"("p_org_id" "uuid") RETURNS TABLE("month" "text", "avg_sentiment" numeric, "session_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_ids uuid[];
BEGIN
    -- Auth Check
    IF NOT EXISTS (
        SELECT 1 FROM "public"."profiles" 
        WHERE "id" = auth.uid() AND "organization_id" = p_org_id
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Get Organization User IDs
    SELECT array_agg(id) INTO v_user_ids
    FROM "public"."profiles"
    WHERE "organization_id" = p_org_id;

    IF v_user_ids IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        to_char(date_trunc('month', "date"), 'YYYY-MM') as "month",
        ROUND(AVG("sentiment_score"), 1) as "avg_sentiment",
        COUNT(*) as "session_count"
    FROM "public"."sessions"
    WHERE "user_id" = ANY(v_user_ids)
    -- Start from 12 months ago
    AND "date" >= (NOW() - INTERVAL '11 months')
    GROUP BY 1
    ORDER BY 1;
END;
$$;


ALTER FUNCTION "public"."get_org_sentiment_trend"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_org_tag_analytics"("p_org_id" "uuid") RETURNS TABLE("tag_id" "uuid", "tag_name" "text", "tag_color" "text", "member_count" bigint, "avg_sentiment" numeric, "risk_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_ids uuid[];
BEGIN
    -- Auth Check
    IF NOT EXISTS (
        SELECT 1 FROM "public"."profiles" 
        WHERE "id" = auth.uid() AND "organization_id" = p_org_id
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Get Organization User IDs
    SELECT array_agg(id) INTO v_user_ids
    FROM "public"."profiles"
    WHERE "organization_id" = p_org_id;

    RETURN QUERY
    WITH TagStats AS (
        SELECT 
            t.id as t_id,
            t.name as t_name,
            t.color as t_color,
            s.id as sub_id,
            s.traits as s_traits
        FROM "public"."tags" t
        JOIN "public"."subordinate_tags" st ON t.id = st.tag_id
        JOIN "public"."subordinates" s ON st.subordinate_id = s.id
        WHERE t.organization_id = p_org_id
        AND s.user_id = ANY(v_user_ids)
    ),
    SessionStats AS (
        SELECT 
            sess.subordinate_id,
            AVG(sess.sentiment_score) as sub_avg_sentiment
        FROM "public"."sessions" sess
        WHERE sess.user_id = ANY(v_user_ids)
        AND sess.date >= (NOW() - INTERVAL '3 months') -- Only recent sessions count for current status
        GROUP BY sess.subordinate_id
    )
    SELECT 
        ts.t_id,
        ts.t_name,
        ts.t_color,
        COUNT(DISTINCT ts.sub_id) as member_count,
        ROUND(AVG(COALESCE(ss.sub_avg_sentiment, 0)), 1) as avg_sentiment, -- Treat no sessions as 0 or ignore? Using 0 for now if null, but careful.
        COUNT(DISTINCT CASE WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(ts.s_traits) tr
            WHERE tr IN ('anxious', 'worried', 'struggling', '不安', '不満')
        ) THEN ts.sub_id END) as risk_count
    FROM TagStats ts
    LEFT JOIN SessionStats ss ON ts.sub_id = ss.subordinate_id
    GROUP BY ts.t_id, ts.t_name, ts.t_color
    ORDER BY avg_sentiment ASC; -- Show lowest sentiment (problematic) tags first
END;
$$;


ALTER FUNCTION "public"."get_org_tag_analytics"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_messaging_integrations_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_messaging_integrations_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."analytics_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "department" "text",
    "metrics" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."analytics_summaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid",
    "comment_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "likes_target_check" CHECK (((("post_id" IS NOT NULL) AND ("comment_id" IS NULL)) OR (("post_id" IS NULL) AND ("comment_id" IS NOT NULL))))
);


ALTER TABLE "public"."likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."line_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "line_user_id" "text",
    "line_access_token" "text",
    "line_display_name" "text",
    "enabled" boolean DEFAULT true,
    "notification_types" "jsonb" DEFAULT '["reminder", "summary", "follow_up"]'::"jsonb",
    "remind_before_minutes" integer DEFAULT 30,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "is_friend" boolean DEFAULT false,
    "friend_status_checked_at" timestamp with time zone
);


ALTER TABLE "public"."line_notifications" OWNER TO "postgres";


COMMENT ON COLUMN "public"."line_notifications"."is_friend" IS 'Whether the LINE user is a friend of the official account';



COMMENT ON COLUMN "public"."line_notifications"."friend_status_checked_at" IS 'When the friend status was last checked';



CREATE TABLE IF NOT EXISTS "public"."messaging_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "webhook_url" "text",
    "api_token" "text",
    "room_id" "text",
    "display_name" "text",
    "enabled" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "messaging_integrations_provider_check" CHECK (("provider" = ANY (ARRAY['slack'::"text", 'chatwork'::"text", 'lineworks'::"text", 'line'::"text"])))
);


ALTER TABLE "public"."messaging_integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "notification_type" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "error_message" "text",
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "notification_logs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'delivered'::"text"])))
);


ALTER TABLE "public"."notification_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "content" "text" NOT NULL,
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."profile_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "role" "text" DEFAULT 'manager'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "google_access_token" "text",
    "google_refresh_token" "text",
    "google_token_expires_at" bigint,
    "organization_id" "uuid",
    "organization_role" "text" DEFAULT 'member'::"text",
    CONSTRAINT "profiles_organization_role_check" CHECK (("organization_role" = ANY (ARRAY['member'::"text", 'admin'::"text"]))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['manager'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "subordinate_id" "uuid" NOT NULL,
    "date" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "mode" "text" NOT NULL,
    "theme" "text",
    "summary" "text",
    "status" "text" DEFAULT 'scheduled'::"text",
    "transcript" "jsonb" DEFAULT '[]'::"jsonb",
    "mind_map_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "agenda_items" "jsonb" DEFAULT '[]'::"jsonb",
    "notes" "jsonb" DEFAULT '[]'::"jsonb",
    "user_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "next_session_date" timestamp with time zone,
    "next_session_duration_minutes" integer DEFAULT 60,
    "line_reminder_scheduled" boolean DEFAULT false,
    "line_reminder_sent_at" timestamp with time zone,
    "sentiment_score" integer,
    CONSTRAINT "check_next_session_duration_positive" CHECK ((("next_session_duration_minutes" IS NULL) OR ("next_session_duration_minutes" > 0))),
    CONSTRAINT "sessions_mode_check" CHECK (("mode" = ANY (ARRAY['web'::"text", 'face-to-face'::"text"]))),
    CONSTRAINT "sessions_sentiment_score_check" CHECK ((("sentiment_score" >= 0) AND ("sentiment_score" <= 10))),
    CONSTRAINT "sessions_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'live'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sessions"."agenda_items" IS 'Array of agenda items for face-to-face sessions. Each item has id, text, completed fields.';



COMMENT ON COLUMN "public"."sessions"."notes" IS 'Array of notes taken during session. Each note has id, content, timestamp, source fields.';



COMMENT ON COLUMN "public"."sessions"."next_session_date" IS 'Date and time of the next scheduled 1on1 session for LINE reminders';



COMMENT ON COLUMN "public"."sessions"."next_session_duration_minutes" IS 'Duration in minutes of the next scheduled session';



COMMENT ON COLUMN "public"."sessions"."line_reminder_scheduled" IS 'Whether LINE reminder has been scheduled for this next session';



COMMENT ON COLUMN "public"."sessions"."line_reminder_sent_at" IS 'When LINE reminder was actually sent (null if not sent yet)';



CREATE TABLE IF NOT EXISTS "public"."subordinate_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subordinate_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."subordinate_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subordinates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "traits" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "user_id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subordinates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#2db7f5'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


ALTER TABLE ONLY "public"."analytics_summaries"
    ADD CONSTRAINT "analytics_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_comment_unique" UNIQUE ("user_id", "comment_id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_post_unique" UNIQUE ("user_id", "post_id");



ALTER TABLE ONLY "public"."line_notifications"
    ADD CONSTRAINT "line_notifications_line_user_id_key" UNIQUE ("line_user_id");



ALTER TABLE ONLY "public"."line_notifications"
    ADD CONSTRAINT "line_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."line_notifications"
    ADD CONSTRAINT "line_notifications_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."messaging_integrations"
    ADD CONSTRAINT "messaging_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_tags"
    ADD CONSTRAINT "profile_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_tags"
    ADD CONSTRAINT "profile_tags_unique" UNIQUE ("profile_id", "tag_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subordinate_tags"
    ADD CONSTRAINT "subordinate_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subordinate_tags"
    ADD CONSTRAINT "subordinate_tags_unique" UNIQUE ("subordinate_id", "tag_id");



ALTER TABLE ONLY "public"."subordinates"
    ADD CONSTRAINT "subordinates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_org_name_key" UNIQUE ("organization_id", "name");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_line_notifications_line_user_id" ON "public"."line_notifications" USING "btree" ("line_user_id");



CREATE INDEX "idx_line_notifications_user_id" ON "public"."line_notifications" USING "btree" ("user_id");



CREATE INDEX "idx_notification_logs_session_id" ON "public"."notification_logs" USING "btree" ("session_id");



CREATE INDEX "idx_notification_logs_status" ON "public"."notification_logs" USING "btree" ("status");



CREATE INDEX "idx_notification_logs_user_id" ON "public"."notification_logs" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_profiles_organization_id" ON "public"."profiles" USING "btree" ("organization_id");



CREATE INDEX "idx_sessions_next_session_date" ON "public"."sessions" USING "btree" ("next_session_date") WHERE (("next_session_date" IS NOT NULL) AND ("line_reminder_scheduled" = false));



CREATE INDEX "idx_sessions_user_id" ON "public"."sessions" USING "btree" ("user_id");



CREATE INDEX "idx_sessions_user_id_next_session_date" ON "public"."sessions" USING "btree" ("user_id", "next_session_date") WHERE (("next_session_date" IS NOT NULL) AND ("line_reminder_scheduled" = false));



CREATE INDEX "idx_subordinate_tags_subordinate_id" ON "public"."subordinate_tags" USING "btree" ("subordinate_id");



CREATE INDEX "idx_subordinate_tags_tag_id" ON "public"."subordinate_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_subordinates_user_id" ON "public"."subordinates" USING "btree" ("user_id");



CREATE INDEX "idx_tags_organization_id" ON "public"."tags" USING "btree" ("organization_id");



CREATE UNIQUE INDEX "messaging_integrations_user_provider_idx" ON "public"."messaging_integrations" USING "btree" ("user_id", "provider");



CREATE OR REPLACE TRIGGER "messaging_integrations_updated_at" BEFORE UPDATE ON "public"."messaging_integrations" FOR EACH ROW EXECUTE FUNCTION "public"."update_messaging_integrations_updated_at"();



CREATE OR REPLACE TRIGGER "update_comments_updated_at" BEFORE UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_line_notifications_updated_at" BEFORE UPDATE ON "public"."line_notifications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_posts_updated_at" BEFORE UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_sessions_updated_at" BEFORE UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_subordinates_updated_at" BEFORE UPDATE ON "public"."subordinates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."analytics_summaries"
    ADD CONSTRAINT "analytics_summaries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."line_notifications"
    ADD CONSTRAINT "line_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messaging_integrations"
    ADD CONSTRAINT "messaging_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_tags"
    ADD CONSTRAINT "profile_tags_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_tags"
    ADD CONSTRAINT "profile_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_subordinate_id_fkey" FOREIGN KEY ("subordinate_id") REFERENCES "public"."subordinates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subordinate_tags"
    ADD CONSTRAINT "subordinate_tags_subordinate_id_fkey" FOREIGN KEY ("subordinate_id") REFERENCES "public"."subordinates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subordinate_tags"
    ADD CONSTRAINT "subordinate_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subordinates"
    ADD CONSTRAINT "subordinates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can manage profile tags" ON "public"."profile_tags" USING ((EXISTS ( SELECT 1
   FROM "public"."tags"
  WHERE (("tags"."id" = "profile_tags"."tag_id") AND ("tags"."organization_id" IN ( SELECT "profiles"."organization_id"
           FROM "public"."profiles"
          WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."organization_role" = 'admin'::"text"))))))));



CREATE POLICY "Admins can manage tags" ON "public"."tags" USING (("organization_id" IN ( SELECT "profiles"."organization_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."organization_role" = 'admin'::"text")))));



CREATE POLICY "Admins can view organization analytics" ON "public"."analytics_summaries" FOR SELECT USING (("organization_id" IN ( SELECT "profiles"."organization_id"
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."organization_role" = 'admin'::"text")))));



CREATE POLICY "Authenticated users can create organizations" ON "public"."organizations" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Comments are visible to authenticated users" ON "public"."comments" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Likes are visible to authenticated users" ON "public"."likes" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Posts are visible to authenticated users" ON "public"."posts" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can create comments" ON "public"."comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create posts" ON "public"."posts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own or legacy sessions" ON "public"."sessions" FOR DELETE USING ((("auth"."uid"() = "user_id") OR ("user_id" IS NULL)));



CREATE POLICY "Users can delete own posts" ON "public"."posts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own subordinates" ON "public"."subordinates" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own or legacy sessions" ON "public"."sessions" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") OR (("user_id" IS NULL) AND ("auth"."uid"() IS NULL))));



CREATE POLICY "Users can insert own subordinates" ON "public"."subordinates" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own LINE notifications" ON "public"."line_notifications" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage tags for own subordinates" ON "public"."subordinate_tags" USING (("subordinate_id" IN ( SELECT "subordinates"."id"
   FROM "public"."subordinates"
  WHERE ("subordinates"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage their own messaging integrations" ON "public"."messaging_integrations" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can toggle likes" ON "public"."likes" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own or legacy sessions" ON "public"."sessions" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR ("user_id" IS NULL)));



CREATE POLICY "Users can update own posts" ON "public"."posts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own subordinates" ON "public"."subordinates" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view organization subordinates" ON "public"."subordinates" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("user_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."organization_id" IN ( SELECT "profiles_1"."organization_id"
           FROM "public"."profiles" "profiles_1"
          WHERE ("profiles_1"."id" = "auth"."uid"())))))));



CREATE POLICY "Users can view organization tags" ON "public"."tags" FOR SELECT USING (("organization_id" IN ( SELECT "profiles"."organization_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own notification logs" ON "public"."notification_logs" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own or legacy sessions" ON "public"."sessions" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("user_id" IS NULL)));



CREATE POLICY "Users can view own organization" ON "public"."organizations" FOR SELECT USING (("id" IN ( SELECT "profiles"."organization_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own subordinates" ON "public"."subordinates" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view profile tags" ON "public"."profile_tags" FOR SELECT USING (("tag_id" IN ( SELECT "tags"."id"
   FROM "public"."tags"
  WHERE ("tags"."organization_id" IN ( SELECT "profiles"."organization_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view subordinate tags" ON "public"."subordinate_tags" FOR SELECT USING (("subordinate_id" IN ( SELECT "subordinates"."id"
   FROM "public"."subordinates"
  WHERE (("subordinates"."user_id" = "auth"."uid"()) OR ("subordinates"."user_id" IN ( SELECT "profiles"."id"
           FROM "public"."profiles"
          WHERE ("profiles"."organization_id" IN ( SELECT "profiles_1"."organization_id"
                   FROM "public"."profiles" "profiles_1"
                  WHERE ("profiles_1"."id" = "auth"."uid"())))))))));



ALTER TABLE "public"."analytics_summaries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."line_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messaging_integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subordinate_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subordinates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";








GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




















































































































































































GRANT ALL ON FUNCTION "public"."create_organization_and_link"("org_name" "text", "org_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_organization_and_link"("org_name" "text", "org_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_organization_and_link"("org_name" "text", "org_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_org_dashboard_stats"("p_org_id" "uuid", "p_tag_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_org_dashboard_stats"("p_org_id" "uuid", "p_tag_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_org_dashboard_stats"("p_org_id" "uuid", "p_tag_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_org_sentiment_trend"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_org_sentiment_trend"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_org_sentiment_trend"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_org_tag_analytics"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_org_tag_analytics"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_org_tag_analytics"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_messaging_integrations_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_messaging_integrations_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_messaging_integrations_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
























GRANT ALL ON TABLE "public"."analytics_summaries" TO "anon";
GRANT ALL ON TABLE "public"."analytics_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_summaries" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."likes" TO "anon";
GRANT ALL ON TABLE "public"."likes" TO "authenticated";
GRANT ALL ON TABLE "public"."likes" TO "service_role";



GRANT ALL ON TABLE "public"."line_notifications" TO "anon";
GRANT ALL ON TABLE "public"."line_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."line_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."messaging_integrations" TO "anon";
GRANT ALL ON TABLE "public"."messaging_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."messaging_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."notification_logs" TO "anon";
GRANT ALL ON TABLE "public"."notification_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_logs" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."profile_tags" TO "anon";
GRANT ALL ON TABLE "public"."profile_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_tags" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."subordinate_tags" TO "anon";
GRANT ALL ON TABLE "public"."subordinate_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."subordinate_tags" TO "service_role";



GRANT ALL ON TABLE "public"."subordinates" TO "anon";
GRANT ALL ON TABLE "public"."subordinates" TO "authenticated";
GRANT ALL ON TABLE "public"."subordinates" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































