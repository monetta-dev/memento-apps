-- Add is_friend and friend_status_checked_at columns to line_notifications table
ALTER TABLE public.line_notifications 
ADD COLUMN IF NOT EXISTS is_friend boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS friend_status_checked_at timestamptz;

-- Update existing records to set is_friend based on presence of line_user_id
-- If line_user_id exists, assume they were friends at connection time
UPDATE public.line_notifications 
SET is_friend = (line_user_id IS NOT NULL AND line_user_id != 'unknown'),
    friend_status_checked_at = updated_at
WHERE is_friend IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.line_notifications.is_friend IS 'Whether the LINE user is a friend of the official account';
COMMENT ON COLUMN public.line_notifications.friend_status_checked_at IS 'When the friend status was last checked';