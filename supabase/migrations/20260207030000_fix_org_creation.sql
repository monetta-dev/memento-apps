-- Drop existing policy if it exists to be safe, or just replace
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON "public"."organizations";

-- Create specific policy for INSERT that allows any authenticated user
CREATE POLICY "Authenticated users can create organizations" ON "public"."organizations"
    FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

-- Also, modifying SELECT policy to include newly created orgs might be needed if the client selects immediately after insert
-- The existing SELECT policy is:
-- "id" IN (SELECT "organization_id" FROM "public"."profiles" WHERE "id" = "auth"."uid"())
-- When inserting, the profile link doesn't exist yet, so the user can't "SEE" the org they just created if the client tries to SELECT it immediately after INSERT without service_role.
-- However, the code does: .insert(...).select().single()
-- The .select() will fail RLS if the user cannot SELECT the row.
-- Since the user isn't linked to the org yet (that happens in step 2), they can't see it.
-- FIX: Allow users to SELECT organizations they created (checking owner? No owner column).
-- OR: Use a function to create org + link profile in one transaction.
-- OR: Relax SELECT policy to allow selecting by ID if known? No, that exposes data.
-- EASIEST FIX: Allow users to select orgs where they are `organization_id` in profile (existing) OR just inserted? No.

-- BETTER FIX: Remove `.select()` from the insert call in the client, OR return only what's needed.
-- BUT Supabase `insert().select()` requires SELECT permission on the returned rows.

-- ALTERNATIVE SQL FIX: Link profile to org via trigger on Organization Insert?
-- No, we don't know who the "admin" user is easily from Trigger (auth.uid() works though).

-- PROPOSED SOLUTION: 
-- 1. Create a function `create_organization(name, code)` that runs with `SECURITY DEFINER`.
--    This function will:
--    a) Insert Org, return ID.
--    b) Update Profile of `auth.uid()` to set `organization_id` and `organization_role`.
--    c) Return the Org data.

CREATE OR REPLACE FUNCTION "public"."create_organization_and_link" (
    "org_name" "text",
    "org_code" "text"
) RETURNS "jsonb"
LANGUAGE "plpgsql"
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION "public"."create_organization_and_link" TO "authenticated";
