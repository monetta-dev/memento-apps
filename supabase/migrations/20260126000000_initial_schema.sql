


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






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






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
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."line_notifications" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "role" "text" DEFAULT 'manager'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
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
    CONSTRAINT "check_next_session_duration_positive" CHECK ((("next_session_duration_minutes" IS NULL) OR ("next_session_duration_minutes" > 0))),
    CONSTRAINT "sessions_mode_check" CHECK (("mode" = ANY (ARRAY['web'::"text", 'face-to-face'::"text"]))),
    CONSTRAINT "sessions_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'live'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sessions"."agenda_items" IS 'Array of agenda items for face-to-face sessions. Each item has id, text, completed fields.';



COMMENT ON COLUMN "public"."sessions"."notes" IS 'Array of notes taken during session. Each note has id, content, timestamp, source fields.';



COMMENT ON COLUMN "public"."sessions"."next_session_date" IS 'Date and time of the next scheduled 1on1 session for LINE reminders';



COMMENT ON COLUMN "public"."sessions"."next_session_duration_minutes" IS 'Duration in minutes of the next scheduled session';



COMMENT ON COLUMN "public"."sessions"."line_reminder_scheduled" IS 'Whether LINE reminder has been scheduled for this next session';



COMMENT ON COLUMN "public"."sessions"."line_reminder_sent_at" IS 'When LINE reminder was actually sent (null if not sent yet)';



CREATE TABLE IF NOT EXISTS "public"."subordinates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "role" "text",
    "department" "text",
    "traits" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."subordinates" OWNER TO "postgres";


ALTER TABLE ONLY "public"."line_notifications"
    ADD CONSTRAINT "line_notifications_line_user_id_key" UNIQUE ("line_user_id");



ALTER TABLE ONLY "public"."line_notifications"
    ADD CONSTRAINT "line_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."line_notifications"
    ADD CONSTRAINT "line_notifications_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subordinates"
    ADD CONSTRAINT "subordinates_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_line_notifications_line_user_id" ON "public"."line_notifications" USING "btree" ("line_user_id");



CREATE INDEX "idx_line_notifications_user_id" ON "public"."line_notifications" USING "btree" ("user_id");



CREATE INDEX "idx_notification_logs_session_id" ON "public"."notification_logs" USING "btree" ("session_id");



CREATE INDEX "idx_notification_logs_status" ON "public"."notification_logs" USING "btree" ("status");



CREATE INDEX "idx_notification_logs_user_id" ON "public"."notification_logs" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_sessions_next_session_date" ON "public"."sessions" USING "btree" ("next_session_date") WHERE (("next_session_date" IS NOT NULL) AND ("line_reminder_scheduled" = false));



CREATE INDEX "idx_sessions_user_id" ON "public"."sessions" USING "btree" ("user_id");



CREATE INDEX "idx_sessions_user_id_next_session_date" ON "public"."sessions" USING "btree" ("user_id", "next_session_date") WHERE (("next_session_date" IS NOT NULL) AND ("line_reminder_scheduled" = false));



CREATE OR REPLACE TRIGGER "update_line_notifications_updated_at" BEFORE UPDATE ON "public"."line_notifications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_sessions_updated_at" BEFORE UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_subordinates_updated_at" BEFORE UPDATE ON "public"."subordinates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."line_notifications"
    ADD CONSTRAINT "line_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_subordinate_id_fkey" FOREIGN KEY ("subordinate_id") REFERENCES "public"."subordinates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow public access to subordinates" ON "public"."subordinates" USING (true);



CREATE POLICY "Allow public read/write access" ON "public"."sessions" USING (true);



CREATE POLICY "Allow public read/write access" ON "public"."subordinates" USING (true);



CREATE POLICY "Users can delete own or legacy sessions" ON "public"."sessions" FOR DELETE USING ((("auth"."uid"() = "user_id") OR ("user_id" IS NULL)));



CREATE POLICY "Users can insert own or legacy sessions" ON "public"."sessions" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") OR (("user_id" IS NULL) AND ("auth"."uid"() IS NULL))));



CREATE POLICY "Users can manage own LINE notifications" ON "public"."line_notifications" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own or legacy sessions" ON "public"."sessions" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR ("user_id" IS NULL)));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own notification logs" ON "public"."notification_logs" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own or legacy sessions" ON "public"."sessions" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("user_id" IS NULL)));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."line_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subordinates" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

















































































































































































GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
























GRANT ALL ON TABLE "public"."line_notifications" TO "anon";
GRANT ALL ON TABLE "public"."line_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."line_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."notification_logs" TO "anon";
GRANT ALL ON TABLE "public"."notification_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_logs" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."subordinates" TO "anon";
GRANT ALL ON TABLE "public"."subordinates" TO "authenticated";
GRANT ALL ON TABLE "public"."subordinates" TO "service_role";









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































