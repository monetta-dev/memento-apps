-- Analytics Optimization: Real Logic & Tag Filtering

DROP FUNCTION IF EXISTS "public"."get_org_dashboard_stats"(uuid);

-- Updated RPC: Supports Tag Filtering and Real Data Calculation
CREATE OR REPLACE FUNCTION "public"."get_org_dashboard_stats"("p_org_id" uuid, "p_tag_id" uuid DEFAULT NULL) 
RETURNS jsonb
LANGUAGE "plpgsql"
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION "public"."get_org_dashboard_stats"(uuid, uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_org_dashboard_stats"(uuid, uuid) TO "service_role";
