-- Check RLS policies for subordinates table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'subordinates'
ORDER BY policyname;

-- Check current user and authentication
SELECT auth.uid() as current_user_id;

-- Check if test user exists and get ID
SELECT id, email FROM auth.users WHERE email = 'test@memento-1on1.com';

-- Check subordinates data with user_id
SELECT id, name, user_id, created_at FROM public.subordinates;

-- Check if RLS is enabled on subordinates table
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'subordinates';