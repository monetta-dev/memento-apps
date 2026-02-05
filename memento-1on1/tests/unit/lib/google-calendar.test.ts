import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGoogleAccessToken, createGoogleCalendarEvent, listGoogleCalendarEvents, type CalendarEvent } from '@/lib/google-calendar';

// Mock createClientComponentClient and supabase
const mockGetSession = vi.fn();
const mockSupabaseClient = {
  auth: {
    getSession: mockGetSession,
  },
};

vi.mock('@/lib/supabase', () => ({
  createClientComponentClient: vi.fn(() => mockSupabaseClient),
}));

describe('lib/google-calendar', () => {
  const originalFetch = global.fetch;
  
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    mockGetSession.mockResolvedValue({ 
      data: { 
        session: { 
          provider_token: 'mock-google-token' 
        } 
      }, 
      error: null 
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getGoogleAccessToken', () => {
    it('should return access token when available', async () => {
      const token = await getGoogleAccessToken();
      
      expect(mockGetSession).toHaveBeenCalled();
      expect(token).toBe('mock-google-token');
    });

    it('should return null when no session exists', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null });
      
      const token = await getGoogleAccessToken();
      
      expect(token).toBeNull();
    });

    it('should return null when no provider_token in session', async () => {
      mockGetSession.mockResolvedValueOnce({ 
        data: { 
          session: { id: '123', user: { id: 'user-1' } } // No provider_token
        }, 
        error: null 
      });
      
      const token = await getGoogleAccessToken();
      
      expect(token).toBeNull();
    });

    it('should return null on error', async () => {
      mockGetSession.mockRejectedValueOnce(new Error('Auth error'));
      
      const token = await getGoogleAccessToken();
      
      expect(token).toBeNull();
    });
  });

  describe('createGoogleCalendarEvent', () => {
    const mockEvent: CalendarEvent = {
      summary: '1on1 Meeting',
      description: 'Weekly 1on1 with team member',
      startTime: new Date('2023-12-01T10:00:00Z'),
      endTime: new Date('2023-12-01T11:00:00Z'),
      attendees: [{ email: 'team@example.com' }],
    };

    it('should create calendar event successfully', async () => {
      const mockResponse = {
        id: 'event-123',
        htmlLink: 'https://calendar.google.com/event/123',
        summary: '1on1 Meeting',
      };

      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await createGoogleCalendarEvent(mockEvent);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer mock-google-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: '1on1 Meeting',
            description: 'Weekly 1on1 with team member',
            start: {
              dateTime: '2023-12-01T10:00:00.000Z',
              timeZone: 'Asia/Tokyo',
            },
            end: {
              dateTime: '2023-12-01T11:00:00.000Z',
              timeZone: 'Asia/Tokyo',
            },
            attendees: [{ email: 'team@example.com' }],
            reminders: {
              useDefault: true,
            },
          }),
        }
      );

      expect(result).toEqual(mockResponse);
    });

    it('should create event with custom calendar ID', async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'event-456' }),
      });

      await createGoogleCalendarEvent(mockEvent, 'custom-calendar-id');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/calendar/v3/calendars/custom-calendar-id/events',
        expect.any(Object)
      );
    });

    it('should throw error when no access token available', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null });

      await expect(createGoogleCalendarEvent(mockEvent))
        .rejects
        .toThrow('No Google access token available. Please sign in with Google.');
    });

    it('should throw error when Google API returns error', async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid request',
      });

      await expect(createGoogleCalendarEvent(mockEvent))
        .rejects
        .toThrow('Google Calendar API error: 400 Bad Request - Invalid request');
    });

    it('should handle network error', async () => {
      (global.fetch as vi.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(createGoogleCalendarEvent(mockEvent))
        .rejects
        .toThrow('Network error');
    });
  });

  describe('listGoogleCalendarEvents', () => {
    it('should list calendar events successfully', async () => {
      const mockResponse = {
        items: [
          { id: 'event-1', summary: 'Meeting 1' },
          { id: 'event-2', summary: 'Meeting 2' },
        ],
      };

      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const timeMin = new Date('2023-12-01T00:00:00Z');
      const timeMax = new Date('2023-12-31T23:59:59Z');
      const result = await listGoogleCalendarEvents('primary', timeMin, timeMax, 20);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=20&singleEvents=true&orderBy=startTime&timeMin=2023-12-01T00%3A00%3A00.000Z&timeMax=2023-12-31T23%3A59%3A59.000Z',
        {
          headers: {
            'Authorization': 'Bearer mock-google-token',
          },
        }
      );

      expect(result).toEqual(mockResponse);
    });

    it('should list events with default parameters', async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      await listGoogleCalendarEvents();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10&singleEvents=true&orderBy=startTime',
        expect.any(Object)
      );
    });

    it('should throw error when no access token available', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null });

      await expect(listGoogleCalendarEvents())
        .rejects
        .toThrow('No Google access token available. Please sign in with Google.');
    });

    it('should throw error when Google API returns error', async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Access denied',
      });

      await expect(listGoogleCalendarEvents())
        .rejects
        .toThrow('Google Calendar API error: 403 Forbidden - Access denied');
    });
  });
});