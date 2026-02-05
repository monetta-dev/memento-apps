-- User Isolation Migration for Memento 1on1
-- This SQL adds user_id column to subordinates table, sets up RLS policies,
-- and cleans up existing subordinate data as requested.

-- 1. Add user_id column to subordinates table (nullable initially)
ALTER TABLE public.subordinates 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Add index for better performance on user_id queries
CREATE INDEX IF NOT EXISTS idx_subordinates_user_id ON public.subordinates(user_id);

-- 3. Remove conflicting public access RLS policies
DROP POLICY IF EXISTS "Allow public access to subordinates" ON public.subordinates;
DROP POLICY IF EXISTS "Allow public read/write access" ON public.subordinates;

-- 4. Create new user-specific RLS policies
-- Users can view their own subordinates
CREATE POLICY "Users can view own subordinates" ON public.subordinates
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert subordinates only with their own user_id
CREATE POLICY "Users can insert own subordinates" ON public.subordinates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own subordinates
CREATE POLICY "Users can update own subordinates" ON public.subordinates
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own subordinates
CREATE POLICY "Users can delete own subordinates" ON public.subordinates
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Add updated_at column if not exists and trigger
ALTER TABLE public.subordinates 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS update_subordinates_updated_at ON public.subordinates;

-- Create trigger for updated_at
CREATE TRIGGER update_subordinates_updated_at 
    BEFORE UPDATE ON public.subordinates 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Clean up sessions table RLS policies
-- Remove conflicting public access policy
DROP POLICY IF EXISTS "Allow public read/write access" ON public.sessions;

-- Note: Existing user-specific policies for sessions remain:
-- "Users can view own or legacy sessions"
-- "Users can insert own or legacy sessions" 
-- "Users can update own or legacy sessions"
-- "Users can delete own or legacy sessions"
-- These allow access to both user's own sessions AND legacy sessions (user_id IS NULL)
-- For stricter isolation, these can be updated later to remove the legacy access

-- 7. DELETE ALL EXISTING SUBORDINATE DATA (clean slate as requested)
DELETE FROM public.subordinates;

-- 8. Make user_id NOT NULL after data cleanup
ALTER TABLE public.subordinates ALTER COLUMN user_id SET NOT NULL;

-- 9. Verify the migration
COMMENT ON TABLE public.subordinates IS 'User-isolated subordinates table. Each subordinate belongs to exactly one user.';