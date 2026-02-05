-- Add user_id column to subordinates table for proper user isolation
-- Migration: add_user_id_to_subordinates

-- 1. Add user_id column (nullable initially for existing data)
ALTER TABLE public.subordinates 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Add index for better performance on user_id queries
CREATE INDEX IF NOT EXISTS idx_subordinates_user_id ON public.subordinates(user_id);

-- 3. Get test user ID for existing data migration
DO $$
DECLARE
  test_user_id UUID;
BEGIN
  -- Get the ID of the test user (assuming test@memento-1on1.com exists)
  SELECT id INTO test_user_id 
  FROM auth.users 
  WHERE email = 'test@memento-1on1.com'
  LIMIT 1;
  
  -- Update existing subordinates to belong to test user
  IF test_user_id IS NOT NULL THEN
    UPDATE public.subordinates 
    SET user_id = test_user_id 
    WHERE user_id IS NULL;
    
    RAISE NOTICE 'Updated subordinates with user_id: %', test_user_id;
  ELSE
    RAISE NOTICE 'Test user not found, existing subordinates will have NULL user_id';
  END IF;
END $$;

-- 4. Remove conflicting public access RLS policies
DROP POLICY IF EXISTS "Allow public access to subordinates" ON public.subordinates;
DROP POLICY IF EXISTS "Allow public read/write access" ON public.subordinates;

-- 5. Create new user-specific RLS policies
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

-- 6. Make user_id NOT NULL after data migration (optional, can be done later)
-- ALTER TABLE public.subordinates ALTER COLUMN user_id SET NOT NULL;

-- 7. Add updated_at column if not exists and trigger
ALTER TABLE public.subordinates 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS update_subordinates_updated_at ON public.subordinates;

-- Create trigger for updated_at
CREATE TRIGGER update_subordinates_updated_at 
    BEFORE UPDATE ON public.subordinates 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Clean up sessions table RLS policies
-- Remove conflicting public access policy
DROP POLICY IF EXISTS "Allow public read/write access" ON public.sessions;

-- Note: Existing user-specific policies for sessions remain:
-- "Users can view own or legacy sessions"
-- "Users can insert own or legacy sessions" 
-- "Users can update own or legacy sessions"
-- "Users can delete own or legacy sessions"
-- These allow access to both user's own sessions AND legacy sessions (user_id IS NULL)
-- For stricter isolation, these can be updated later to remove the legacy access

-- 9. Optional: Create a separate migration script for data cleanup
-- This would assign user_id to legacy sessions based on some logic
-- For now, we maintain backward compatibility with legacy sessions