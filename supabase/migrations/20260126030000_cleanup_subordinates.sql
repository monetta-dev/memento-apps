-- Clean up subordinate data and enforce NOT NULL constraint
-- Migration: cleanup_subordinates

-- Delete all existing subordinate data (clean slate for user isolation)
DELETE FROM public.subordinates;

-- Ensure user_id is NOT NULL (should already be set by previous migration, but enforce)
ALTER TABLE public.subordinates ALTER COLUMN user_id SET NOT NULL;