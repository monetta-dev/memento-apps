-- Consolidated database schema for Memento 1on1 application
-- This file replaces all previous migrations with a single, clear schema definition

-- Enable UUID extension (using gen_random_uuid() for better compatibility)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Subordinates Table
CREATE TABLE IF NOT EXISTS public.subordinates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  department TEXT,
  traits JSONB DEFAULT '[]'::JSONB, -- Array of strings e.g. ["Logical", "Visual"]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Sessions Table (with agenda_items and notes for face-to-face mode)
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subordinate_id UUID REFERENCES public.subordinates(id) ON DELETE CASCADE NOT NULL,
  date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  mode TEXT CHECK (mode IN ('web', 'face-to-face')) NOT NULL,
  theme TEXT,
  summary TEXT,
  status TEXT CHECK (status IN ('scheduled', 'live', 'completed')) DEFAULT 'scheduled',
  
  -- JSONB columns for flexible data storage
  transcript JSONB DEFAULT '[]'::JSONB, -- Array of {speaker, text, timestamp}
  mind_map_data JSONB DEFAULT '{}'::JSONB, -- React Flow {nodes, edges}
  agenda_items JSONB DEFAULT '[]'::JSONB, -- Array of agenda items for face-to-face sessions
  notes JSONB DEFAULT '[]'::JSONB, -- Array of notes taken during session
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Profiles Table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'manager' CHECK (role IN ('manager', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. LINE Notifications Table
CREATE TABLE IF NOT EXISTS public.line_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  line_user_id TEXT UNIQUE, -- LINE user ID (after OAuth connection)
  line_access_token TEXT, -- Encrypted access token
  line_display_name TEXT, -- LINE display name
  enabled BOOLEAN DEFAULT TRUE,
  notification_types JSONB DEFAULT '["reminder", "summary", "follow_up"]'::JSONB,
  remind_before_minutes INTEGER DEFAULT 30, -- Reminder time (minutes before)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id)
);

-- 5. Notification Logs Table
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL, -- 'reminder', 'summary', 'follow_up', 'error'
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subordinates_created_at ON public.subordinates(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON public.sessions(date);
CREATE INDEX IF NOT EXISTS idx_sessions_subordinate_id ON public.sessions(subordinate_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_line_notifications_user_id ON public.line_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_line_notifications_line_user_id ON public.line_notifications(line_user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON public.notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_session_id ON public.notification_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON public.notification_logs(status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.subordinates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for MVP (allow public access without authentication)
-- For production, replace with proper authentication policies

-- Subordinates: allow public read/write access
CREATE POLICY "Allow public access to subordinates" ON public.subordinates
  FOR ALL USING (true);

-- Sessions: allow public read/write access  
CREATE POLICY "Allow public access to sessions" ON public.sessions
  FOR ALL USING (true);

-- Profiles: users can only see/update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- LINE notifications: users can manage their own notifications
CREATE POLICY "Users can manage own LINE notifications" ON public.line_notifications
  FOR ALL USING (auth.uid() = user_id);

-- Notification logs: users can view their own logs
CREATE POLICY "Users can view own notification logs" ON public.notification_logs
  FOR ALL USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_subordinates_updated_at BEFORE UPDATE ON public.subordinates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_line_notifications_updated_at BEFORE UPDATE ON public.line_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Comments for documentation
COMMENT ON TABLE public.subordinates IS 'Subordinates (team members) managed by users';
COMMENT ON TABLE public.sessions IS '1on1 sessions between managers and subordinates';
COMMENT ON TABLE public.profiles IS 'User profiles extending Supabase auth.users';
COMMENT ON TABLE public.line_notifications IS 'LINE notification settings for users';
COMMENT ON TABLE public.notification_logs IS 'Log of notifications sent to users';

COMMENT ON COLUMN public.sessions.agenda_items IS 'Array of agenda items for face-to-face sessions. Each item has id, text, completed fields.';
COMMENT ON COLUMN public.sessions.notes IS 'Array of notes taken during session. Each note has id, content, timestamp, source fields.';
COMMENT ON COLUMN public.subordinates.traits IS 'Array of personality/character traits for the subordinate';