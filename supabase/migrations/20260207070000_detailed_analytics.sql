-- Detailed Analytics: Sentiment Score and Aggregation RPCs

-- 1. Add sentiment_score to sessions table
-- This stores the AI-analyzed sentiment (0-10) for each 1on1 session.
ALTER TABLE "public"."sessions" 
ADD COLUMN IF NOT EXISTS "sentiment_score" INTEGER CHECK (sentiment_score >= 0 AND sentiment_score <= 10);

-- 2. RPC: Get Organization Sentiment Trend (Time Series)
-- Returns average sentiment and session count grouped by month for the last 12 months (or specified range implied by limit)
CREATE OR REPLACE FUNCTION "public"."get_org_sentiment_trend"("p_org_id" uuid) 
RETURNS TABLE (
    "month" text,
    "avg_sentiment" numeric,
    "session_count" bigint
)
LANGUAGE "plpgsql"
SECURITY DEFINER
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

-- 3. RPC: Get Organization Tag Analytics (Comparative)
-- Returns stats per tag: Member count, Avg Sentiment (from last 3 months sessions), Risk count
CREATE OR REPLACE FUNCTION "public"."get_org_tag_analytics"("p_org_id" uuid) 
RETURNS TABLE (
    "tag_id" uuid,
    "tag_name" text,
    "tag_color" text,
    "member_count" bigint,
    "avg_sentiment" numeric,
    "risk_count" bigint
)
LANGUAGE "plpgsql"
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION "public"."get_org_sentiment_trend"(uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_org_sentiment_trend"(uuid) TO "service_role";
GRANT EXECUTE ON FUNCTION "public"."get_org_tag_analytics"(uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_org_tag_analytics"(uuid) TO "service_role";
