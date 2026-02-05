import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';

// Mock Supabase methods - use hoisted mock to avoid hoisting issues
const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
}));

// Mock the supabase module
vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

describe('useStore', () => {
  let store: ReturnType<typeof useStore.getState>;

  beforeEach(() => {
    // Reset store state before each test
    useStore.setState({
      subordinates: [],
      sessions: [],
      isLoading: false,
      error: null,
    });
    store = useStore.getState();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      expect(store.subordinates).toEqual([]);
      expect(store.sessions).toEqual([]);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });
  });

  describe('fetchSubordinates', () => {
    it('should fetch subordinates successfully', async () => {
      const mockData = [
        { 
          id: '1', 
          name: 'John Doe', 
          role: 'Engineer', 
          department: 'Tech', 
          traits: ['hardworking'],
          created_at: '2023-01-01'
        },
        { 
          id: '2', 
          name: 'Jane Smith', 
          role: 'Designer', 
          department: 'Design', 
          traits: ['creative'],
          created_at: '2023-01-02'
        },
      ];

      // Setup mock chain: from('subordinates').select('*').order('created_at', { ascending: false })
      const mockOrder = vi.fn().mockResolvedValue({ data: mockData, error: null });
      const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      await store.fetchSubordinates();

      expect(mockSupabase.from).toHaveBeenCalledWith('subordinates');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
      
      // Store should have updated with mapped data
      const updatedStore = useStore.getState();
      expect(updatedStore.subordinates).toHaveLength(2);
      expect(updatedStore.subordinates[0].name).toBe('John Doe');
      expect(updatedStore.subordinates[1].name).toBe('Jane Smith');
      expect(updatedStore.isLoading).toBe(false);
      expect(updatedStore.error).toBeNull();
    });

    it('should handle fetch error', async () => {
      const mockError = new Error('Database error');
      
      // Setup mock chain with error
      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: mockError });
      const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      await store.fetchSubordinates();
      
      const updatedStore = useStore.getState();
      expect(updatedStore.error).toBe('Database error');
      expect(updatedStore.isLoading).toBe(false);
      expect(updatedStore.subordinates).toEqual([]);
    });


  });

  describe('addSubordinate', () => {
    it('should add subordinate successfully', async () => {
      const newSub = {
        name: 'New Employee',
        role: 'Analyst',
        department: 'Data',
        traits: ['analytical'],
      };

      const mockInsertResponse = {
        data: [{ 
          id: '3', 
          name: 'New Employee',
          role: 'Analyst',
          department: 'Data',
          traits: ['analytical'],
          created_at: '2023-01-01' 
        }],
        error: null,
      };

      // Setup mock chain: from('subordinates').insert([...]).select()
      const mockSelect = vi.fn().mockResolvedValue(mockInsertResponse);
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      mockSupabase.from.mockReturnValue({ insert: mockInsert });

      await store.addSubordinate(newSub);

      expect(mockSupabase.from).toHaveBeenCalledWith('subordinates');
      expect(mockInsert).toHaveBeenCalledWith([{
        name: newSub.name,
        role: newSub.role,
        department: newSub.department,
        traits: newSub.traits,
      }]);
      
      const updatedStore = useStore.getState();
      expect(updatedStore.subordinates).toHaveLength(1);
      expect(updatedStore.subordinates[0].name).toBe('New Employee');
    });

    it('should handle add subordinate error', async () => {
      const newSub = {
        name: 'New Employee',
        role: 'Analyst',
        department: 'Data',
        traits: ['analytical'],
      };

      const mockError = new Error('Insert failed');
      
      // Setup mock chain with error
      const mockSelect = vi.fn().mockResolvedValue({ data: null, error: mockError });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      mockSupabase.from.mockReturnValue({ insert: mockInsert });

      await store.addSubordinate(newSub);
      
      const updatedStore = useStore.getState();
      expect(updatedStore.error).toBe('Insert failed');
      expect(updatedStore.subordinates).toEqual([]);
    });
  });

  describe('getSession', () => {
    it('should return session by id', () => {
      const mockSessions = [
        { 
          id: '1', 
          subordinateId: '1', 
          date: '2023-01-01', 
          mode: 'face-to-face' as const, 
          theme: 'Progress', 
          status: 'completed' as const,
          transcript: [],
          mindMapData: { nodes: [], edges: [] }
        },
        { 
          id: '2', 
          subordinateId: '2', 
          date: '2023-01-02', 
          mode: 'web' as const, 
          theme: 'Feedback', 
          status: 'live' as const,
          transcript: [],
          mindMapData: { nodes: [], edges: [] }
        },
      ];

      useStore.setState({ sessions: mockSessions });
      store = useStore.getState();

      const session = store.getSession('2');
      expect(session).toEqual(mockSessions[1]);
      expect(session?.theme).toBe('Feedback');
    });

    it('should return undefined for non-existent session', () => {
      useStore.setState({
        sessions: [{ 
          id: '1', 
          subordinateId: '1', 
          date: '2023-01-01', 
          mode: 'face-to-face' as const, 
          theme: 'Progress', 
          status: 'completed' as const,
          transcript: [],
          mindMapData: { nodes: [], edges: [] }
        }],
      });
      store = useStore.getState();

      const session = store.getSession('999');
      expect(session).toBeUndefined();
    });
  });

  describe('updateSession', () => {
    it('should update session with mindMapData and trigger Supabase update', async () => {
      const mockSession = {
        id: '1',
        subordinateId: '1',
        date: '2023-01-01',
        mode: 'face-to-face' as const,
        theme: 'Progress',
        status: 'live' as const,
        transcript: [],
        mindMapData: { nodes: [], edges: [] }
      };

      useStore.setState({ sessions: [mockSession] });
      store = useStore.getState();

      const newMindMapData = {
        nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'Test Node' } }],
        edges: [],
        actionItems: ['Test action']
      };

      // Setup mock for Supabase update chain: from('sessions').update(data).eq('id', '1').select().single()
      const mockSingle = vi.fn().mockResolvedValue({ data: { id: '1' }, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ update: mockUpdate });

      await store.updateSession('1', { mindMapData: newMindMapData });

      // Check store update
      const updatedStore = useStore.getState();
      expect(updatedStore.sessions[0].mindMapData).toEqual(newMindMapData);

      // Check Supabase call
      expect(mockSupabase.from).toHaveBeenCalledWith('sessions');
      expect(mockUpdate).toHaveBeenCalledWith({ mind_map_data: newMindMapData });
      expect(mockEq).toHaveBeenCalledWith('id', '1');
      expect(mockSelect).toHaveBeenCalled();
      expect(mockSingle).toHaveBeenCalled();
    });

    it('should update session status to completed and trigger Supabase update', async () => {
      const mockSession = {
        id: '1',
        subordinateId: '1',
        date: '2023-01-01',
        mode: 'face-to-face' as const,
        theme: 'Progress',
        status: 'live' as const,
        transcript: [],
        mindMapData: { nodes: [], edges: [] }
      };

      useStore.setState({ sessions: [mockSession] });
      store = useStore.getState();

      // Setup mock for Supabase update
      const mockUpdate = vi.fn().mockResolvedValue({ error: null });
      const mockEq = vi.fn().mockReturnValue({ update: mockUpdate });
      mockSupabase.from.mockReturnValue({ eq: mockEq });

      await store.updateSession('1', { status: 'completed' });

      // Check store update
      const updatedStore = useStore.getState();
      expect(updatedStore.sessions[0].status).toBe('completed');

      // Check Supabase call
      expect(mockSupabase.from).toHaveBeenCalledWith('sessions');
      expect(mockEq).toHaveBeenCalledWith('id', '1');
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'completed' });
    });

    it('should handle Supabase update error', async () => {
      const mockSession = {
        id: '1',
        subordinateId: '1',
        date: '2023-01-01',
        mode: 'face-to-face' as const,
        theme: 'Progress',
        status: 'live' as const,
        transcript: [],
        mindMapData: { nodes: [], edges: [] }
      };

      useStore.setState({ sessions: [mockSession] });
      store = useStore.getState();

      const mockError = new Error('Update failed');
      const mockUpdate = vi.fn().mockResolvedValue({ error: mockError });
      const mockEq = vi.fn().mockReturnValue({ update: mockUpdate });
      mockSupabase.from.mockReturnValue({ eq: mockEq });

      // Should not throw error
      await store.updateSession('1', { status: 'completed' });

      // Store should still be updated optimistically
      const updatedStore = useStore.getState();
      expect(updatedStore.sessions[0].status).toBe('completed');
    });
  });
});