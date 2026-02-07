import { create } from 'zustand';
import { createClientComponentClient } from '@/lib/supabase';
import { Node, Edge } from '@xyflow/react';


export interface TranscriptItem {
  speaker: 'manager' | 'subordinate';
  text: string;
  timestamp: string;
}

export interface MindMapData {
  nodes: Node[];
  edges: Edge[];
  actionItems?: string[];
}

export interface AgendaItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Note {
  id: string;
  content: string;
  timestamp: string;
  source?: 'manual' | 'ai' | 'transcript';
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Subordinate {
  id: string;
  name: string;
  traits: string[]; // Deprecated, keeping for backward compatibility
  tags?: Tag[]; // New Tag system
  lastOneOnOne?: string;
  created_at?: string;
}

export interface Session {
  id: string;
  subordinateId: string; // CamelCase for internal use, mapped from snake_case DB
  date: string;
  mode: 'face-to-face' | 'web';
  theme: string;
  summary?: string;
  transcript?: TranscriptItem[];
  mindMapData?: MindMapData;
  agendaItems?: AgendaItem[];
  notes?: Note[];
  status: 'scheduled' | 'completed' | 'live';
  created_at?: string;
  // Next session scheduling for LINE reminders
  nextSessionDate?: string;
  nextSessionDurationMinutes?: number;
  lineReminderScheduled?: boolean;
  lineReminderSentAt?: string;
  // User association for LINE notifications
  userId?: string;
}

interface AppState {
  subordinates: Subordinate[];
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  userId?: string;

  // Actions
  setUserId: (userId: string) => void;
  fetchSubordinates: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  addSubordinate: (sub: Omit<Subordinate, 'id' | 'created_at'>) => Promise<void>;
  updateSubordinate: (id: string, updates: Partial<Subordinate>) => Promise<void>;
  addSession: (session: Omit<Session, 'id' | 'created_at' | 'status'>, userId?: string) => Promise<string | null>;
  updateSession: (id: string, updates: Partial<Session>) => Promise<void>;
  getSession: (id: string) => Session | undefined;
}

export const useStore = create<AppState>((set, get) => ({
  subordinates: [],
  sessions: [],
  isLoading: false,
  error: null,
  userId: undefined,
  setUserId: (userId: string) => set({ userId }),

  fetchSubordinates: async () => {
    console.log('fetchSubordinates called, userId:', get().userId);
    try {
      const client = createClientComponentClient();
      set({ isLoading: true });
      const { userId } = get();

      // Fetch Subordinates with their tags
      // Note: Supabase JS join syntax
      let query = client.from('subordinates').select(`
        *,
        subordinate_tags (
          tags (
            id,
            name,
            color
          )
        )
      `);

      // Filter by user_id if userId is set
      if (userId) {
        query = query.eq('user_id', userId);
        console.log('fetchSubordinates: filtering by user_id:', userId);
      } else {
        console.log('fetchSubordinates: no userId, fetching all subordinates');
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('fetchSubordinates error:', error.message);
        console.error('fetchSubordinates error details:', error);
        set({ error: error.message, isLoading: false });
      } else {
        console.log('fetchSubordinates success, data count:', data.length);
        console.log('fetchSubordinates raw data:', data);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedData = data.map((item: any) => ({
          ...item,
          traits: typeof item.traits === 'string' ? JSON.parse(item.traits) : item.traits,
          // Map nested join result to flat tags array
          tags: item.subordinate_tags?.map((st: any) => st.tags) || []
        }));
        set({ subordinates: mappedData, isLoading: false });
      }
    } catch (err) {
      console.error('fetchSubordinates: failed to create client:', err);
      set({ isLoading: false });
    }
  },

  fetchSessions: async () => {
    console.log('fetchSessions called');
    try {
      const client = createClientComponentClient();
      set({ isLoading: true });
      const { data, error } = await client.from('sessions').select('*').order('date', { ascending: false });
      if (error) {
        console.error('fetchSessions error:', error);
        set({ error: error.message, isLoading: false });
      } else {
        console.log('fetchSessions success, data count:', data?.length || 0);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedData = data.map((item: any) => ({
          id: item.id,
          subordinateId: item.subordinate_id,
          date: item.date,
          mode: item.mode,
          theme: item.theme,
          summary: item.summary,
          status: item.status,
          transcript: item.transcript,
          mindMapData: item.mind_map_data,
          agendaItems: item.agenda_items,
          notes: item.notes,
          nextSessionDate: item.next_session_date,
          nextSessionDurationMinutes: item.next_session_duration_minutes,
          lineReminderScheduled: item.line_reminder_scheduled,
          lineReminderSentAt: item.line_reminder_sent_at,
          userId: item.user_id
        }));
        set({ sessions: mappedData, isLoading: false });
      }
    } catch (err) {
      console.error('fetchSessions: failed to create client:', err);
      set({ isLoading: false });
    }
  },

  addSubordinate: async (sub) => {
    try {
      const client = createClientComponentClient();
      set({ isLoading: true });
      const { userId } = get();

      // Fetch user's organization_id
      // REVERTED: User requested normalized approach.
      // const { data: profile } = await client...

      const subordinateData = {
        name: sub.name,
        traits: sub.traits,
        user_id: userId,
        // organization_id: organizationId // REVERTED
      };

      const { data, error } = await client
        .from('subordinates')
        .insert(subordinateData)
        .select()
        .single();

      if (error) {
        console.error('Error adding subordinate:', error);
        set({ error: error.message, isLoading: false });
      } else {
        console.log('Subordinate added:', data);

        // Handle Tags insertion
        if (sub.tags && sub.tags.length > 0) {
          const tagInserts = sub.tags.map(t => ({
            subordinate_id: data.id,
            tag_id: t.id
          }));
          const { error: tagError } = await client.from('subordinate_tags').insert(tagInserts);
          if (tagError) console.error('Error adding tags:', tagError);
        }

        // Re-fetch to get complete data with tags
        await get().fetchSubordinates();
      }
    } catch (err) {
      console.error('addSubordinate: failed to create client:', err);
      set({ isLoading: false });
    }
  },

  addSession: async (session, userId) => {
    try {
      const client = createClientComponentClient();
      set({ isLoading: true });

      const { data, error } = await client.from('sessions').insert([{
        subordinate_id: session.subordinateId,
        date: session.date,
        mode: session.mode,
        theme: session.theme,
        status: 'live', // Start as live immediately for this prototype flow
        ...(userId ? { user_id: userId } : {}),
        transcript: [],
        mind_map_data: {}
      }]).select();

      if (error) {
        set({ error: error.message, isLoading: false });
        return null;
      } else if (data) {
        const newSession = {
          ...data[0],
          subordinateId: data[0].subordinate_id,
          mindMapData: data[0].mind_map_data
        };
        set((state) => ({
          sessions: [newSession, ...state.sessions],
          isLoading: false
        }));



        return newSession.id;
      }
      return null;
    } catch (err) {
      console.error('addSession: failed to create client:', err);
      set({ isLoading: false });
      return null;
    }
  },

  updateSubordinate: async (id, updates) => {
    try {
      const client = createClientComponentClient();
      // Optimistic update
      set((state) => ({
        subordinates: state.subordinates.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      }));

      // DB map
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.traits) dbUpdates.traits = updates.traits;
      if (updates.lastOneOnOne) dbUpdates.last_one_on_one = updates.lastOneOnOne;

      const { error } = await client.from('subordinates').update(dbUpdates).eq('id', id);
      if (error) {
        console.error("Failed to sync subordinate update", error);
        // Revert or show error could be handled here
      }
    } catch (err) {
      console.error('updateSubordinate: failed to create client:', err);
    }
  },

  updateSession: async (id, updates) => {
    try {
      const client = createClientComponentClient();
      console.log('updateSession called:', { id, updates });
      // Optimistic update
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      }));

      // DB map
      const dbUpdates: Record<string, unknown> = {};
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.summary) dbUpdates.summary = updates.summary;
      if (updates.transcript) dbUpdates.transcript = updates.transcript;
      if (updates.mindMapData) {
        // Log mindmap data structure for debugging
        if (process.env.NODE_ENV === 'development') {
          console.log('MindMapData to save:', {
            nodesCount: updates.mindMapData.nodes?.length || 0,
            edgesCount: updates.mindMapData.edges?.length || 0,
            nodesSample: updates.mindMapData.nodes?.slice(0, 1),
            edgesSample: updates.mindMapData.edges?.slice(0, 1),
          });
        }
        dbUpdates.mind_map_data = updates.mindMapData;
      }
      if (updates.agendaItems) dbUpdates.agenda_items = updates.agendaItems;
      if (updates.notes) dbUpdates.notes = updates.notes;
      if (updates.nextSessionDate !== undefined) dbUpdates.next_session_date = updates.nextSessionDate;
      if (updates.nextSessionDurationMinutes !== undefined) dbUpdates.next_session_duration_minutes = updates.nextSessionDurationMinutes;
      if (updates.lineReminderScheduled !== undefined) dbUpdates.line_reminder_scheduled = updates.lineReminderScheduled;
      if (updates.lineReminderSentAt !== undefined) dbUpdates.line_reminder_sent_at = updates.lineReminderSentAt;
      if (updates.userId !== undefined) dbUpdates.user_id = updates.userId;

      console.log('Updating Supabase session with:', dbUpdates);
      const { error, data } = await client
        .from('sessions')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error("Failed to sync session update", {
          errorMessage: error?.message,
          errorDetails: error?.details,
          errorHint: error?.hint,
          errorCode: error?.code,
          errorFull: error,
          dbUpdates,
          id,
          timestamp: new Date().toISOString()
        });
        // Revert or show error could be handled here
      } else {
        console.log('Supabase session update successful', data);
      }
    } catch (err) {
      console.error('Unexpected error updating session:', err);
    }
  },

  getSession: (id) => get().sessions.find((s) => s.id === id),
}));
