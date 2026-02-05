-- Add Google OAuth token columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS google_access_token text,
ADD COLUMN IF NOT EXISTS google_refresh_token text,
ADD COLUMN IF NOT EXISTS google_token_expires_at bigint;

-- Create security policy so users can only read/update their own tokens (already covered by existing policies, but good to double check)
-- Existing policy "Users can update own profile" covers UPDATE
-- Existing policy "Users can view own profile" covers SELECT

-- However, we might want to restrict reading refresh tokens to only be server-side if possible, 
-- but since we are using row level security where users can only see their own data, it is acceptable for now.
-- Ideally these should be in a separate private table or vault, but for this app complexity `profiles` is sufficient.
