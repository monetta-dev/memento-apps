import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Make sure .env.test is loaded.');
}

// Use anon client for database operations (requires RLS policies to allow)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Subordinate {
  id?: string;
  name: string;
  role?: string;
  department?: string;
  traits?: string[] | null;
}

export interface Session {
  id?: string;
  subordinate_id: string;
  user_id?: string | null; // Added for user isolation
  date?: string; // ISO string
  mode: 'web' | 'face-to-face';
  theme?: string;
  summary?: string;
  status?: 'scheduled' | 'live' | 'completed';
  transcript?: unknown[]; // JSONB array
  mind_map_data?: Record<string, unknown>; // JSONB object
  agenda_items?: unknown[]; // JSONB array of agenda items
  notes?: unknown[]; // JSONB array of notes
}

/**
 * Ensure at least one subordinate exists for testing
 * Returns the first subordinate or creates a default one
 */
export async function ensureSubordinate(): Promise<Subordinate> {
  // Try to fetch existing subordinates
  const { data, error } = await supabase
    .from('subordinates')
    .select('*')
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch subordinates: ${error.message}`);
  }

  if (data && data.length > 0) {
    return data[0] as Subordinate;
  }

  // Create a default subordinate
  const newSubordinate: Subordinate = {
    name: 'テスト部下',
    role: 'エンジニア',
    department: '開発部',
    traits: ['詳細志向', '論理的', '協調性'],
  };

  const { data: inserted, error: insertError } = await supabase
    .from('subordinates')
    .insert(newSubordinate)
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to create subordinate: ${insertError.message}`);
  }

  console.log('Created default subordinate:', inserted.id);
  return inserted as Subordinate;
}

/**
 * Create a test session
 */
export async function createTestSession(
  subordinateId: string,
  options: Partial<Session> = {}
): Promise<Session> {
  const defaultSession: Session = {
    subordinate_id: subordinateId,
    user_id: null, // Set NULL user_id for backward compatibility
    date: new Date().toISOString(),
    mode: 'face-to-face',
    theme: 'テストセッション',
    status: 'completed',
    transcript: [],
    mind_map_data: { nodes: [], edges: [] },
    ...options,
  };

  const { data, error } = await supabase
    .from('sessions')
    .insert(defaultSession)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  console.log('Created test session:', data.id);
  return data as Session;
}

/**
 * Get all sessions for a subordinate
 */
export async function getSessionsBySubordinate(subordinateId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('subordinate_id', subordinateId);

  if (error) {
    throw new Error(`Failed to fetch sessions: ${error.message}`);
  }

  return data as Session[];
}

/**
 * Delete a session by ID
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    throw new Error(`Failed to delete session: ${error.message}`);
  }

  console.log('Deleted session:', sessionId);
}

/**
 * Delete all test sessions (cleanup)
 */
export async function cleanupTestSessions(): Promise<void> {
  // Be careful with this in production
  // Only delete sessions that are clearly test sessions (e.g., by theme)
  const { error } = await supabase
    .from('sessions')
    .delete()
    .like('theme', 'テスト%');

  if (error) {
    console.warn('Failed to cleanup test sessions:', error.message);
  } else {
    console.log('Cleaned up test sessions');
  }
}

/**
 * Delete all test subordinates (cleanup)
 */
export async function cleanupTestSubordinates(): Promise<void> {
  // Delete subordinates created for testing
  const { error } = await supabase
    .from('subordinates')
    .delete()
    .like('name', 'テスト%');

  if (error) {
    console.warn('Failed to cleanup test subordinates:', error.message);
  } else {
    console.log('Cleaned up test subordinates');
  }
}

/**
 * Setup test database with required data
 */
export async function setupTestData(): Promise<{
  subordinate: Subordinate;
  session?: Session;
}> {
  const subordinate = await ensureSubordinate();
  
  // Optionally create a session
  // const session = await createTestSession(subordinate.id!);
  
  return { subordinate };
}

/**
 * Cleanup test data
 */
export async function cleanupTestData(): Promise<void> {
  await cleanupTestSessions();
  await cleanupTestSubordinates();
}

/**
 * Reset database state for tests (use with caution)
 */
export async function resetTestDatabase(): Promise<void> {
  console.warn('Resetting test database - this will delete all data!');
  
  // Delete all sessions
  const { error: sessionsError } = await supabase
    .from('sessions')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all

  if (sessionsError) {
    console.warn('Failed to delete sessions:', sessionsError.message);
  }

  // Delete all subordinates except maybe seeded ones
  const { error: subordinatesError } = await supabase
    .from('subordinates')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (subordinatesError) {
    console.warn('Failed to delete subordinates:', subordinatesError.message);
  }

  // Note: We don't delete profiles as they are tied to auth.users
  console.log('Test database reset complete');
}