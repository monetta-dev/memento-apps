import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupGeminiMocks, withEnvReset, createMockRequest } from '../../utils/gemini-mocks';

describe('API: /api/chat/summarize', () => {
  withEnvReset();
  let mockGenerateContent: ReturnType<typeof vi.fn>;
  let mockGetGenerativeModel: ReturnType<typeof vi.fn>;
  let mockGoogleGenerativeAI: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create fresh mocks for each test to avoid interference
    const mocks = setupGeminiMocks();
    mockGenerateContent = mocks.mockGenerateContent;
    mockGetGenerativeModel = mocks.mockGetGenerativeModel;
    mockGoogleGenerativeAI = mocks.mockGoogleGenerativeAI;
  });

  describe('POST', () => {
    const mockTranscript = [
      { speaker: 'manager', text: 'How are things going with the project?' },
      { speaker: 'subordinate', text: 'It\'s going well, we\'re on track for the deadline.' },
      { speaker: 'manager', text: 'Any blockers or concerns?' },
      { speaker: 'subordinate', text: 'We need more clarity on the API requirements.' },
    ];

    const mockTheme = 'Project Progress';

    it('should return 400 error when transcript is missing', async () => {
      // Need to import after setting up mocks
      const { POST } = await import('@/app/api/chat/summarize/route');
      const req = createMockRequest('/api/chat/summarize', 'POST', { theme: 'test' });
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No valid transcript provided');
    });

    it('should return 400 error when transcript is not an array', async () => {
      const { POST } = await import('@/app/api/chat/summarize/route');
      const req = createMockRequest('/api/chat/summarize', 'POST', { transcript: 'not-an-array', theme: 'test' });
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No valid transcript provided');
    });

    it('should return mock summary when GEMINI_API_KEY is not configured', async () => {
      delete process.env.GEMINI_API_KEY;
      const { POST } = await import('@/app/api/chat/summarize/route');
      
      const req = createMockRequest('/api/chat/summarize', 'POST', { transcript: mockTranscript, theme: mockTheme });
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary).toBe('Mock Summary: Please set GEMINI_API_KEY to get real AI summaries.');
      expect(data.actionItems).toEqual(['Mock Action Item 1', 'Mock Action Item 2']);
      
      // Should not call Google Generative AI
      expect(mockGoogleGenerativeAI).not.toHaveBeenCalled();
    });

    it('should return AI summary when GEMINI_API_KEY is configured', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      
      // Mock Gemini API response
      const mockResponse = {
        response: {
          text: vi.fn().mockReturnValue(JSON.stringify({
            summary: 'The project is progressing well with the team on track for the deadline.',
            actionItems: ['Clarify API requirements with the team', 'Schedule follow-up meeting next week'],
          })),
        },
      };
      
      mockGenerateContent.mockResolvedValue(mockResponse);
      
      const { POST } = await import('@/app/api/chat/summarize/route');
      const req = createMockRequest('/api/chat/summarize', 'POST', { transcript: mockTranscript, theme: mockTheme });
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary).toBe('The project is progressing well with the team on track for the deadline.');
      expect(data.actionItems).toEqual([
        'Clarify API requirements with the team',
        'Schedule follow-up meeting next week',
      ]);
      
      // Verify Gemini API was called correctly
      expect(mockGoogleGenerativeAI).toHaveBeenCalledWith('test-api-key');
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-2.0-flash',
        generationConfig: { responseMimeType: 'application/json' },
      });
      
      // Check that prompt includes transcript and theme
      expect(mockGenerateContent).toHaveBeenCalled();
      const prompt = mockGenerateContent.mock.calls[0][0];
      expect(prompt).toContain('Theme: "Project Progress"');
      expect(prompt).toContain('manager: How are things going with the project?');
      expect(prompt).toContain('subordinate: It\'s going well, we\'re on track for the deadline.');
    });

    it('should handle empty transcript array', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      
      const mockResponse = {
        response: {
          text: vi.fn().mockReturnValue(JSON.stringify({
            summary: 'No conversation recorded.',
            actionItems: [],
          })),
        },
      };
      
      mockGenerateContent.mockResolvedValue(mockResponse);
      
      const { POST } = await import('@/app/api/chat/summarize/route');
      const req = createMockRequest('/api/chat/summarize', 'POST', { transcript: [], theme: 'Empty Meeting' });
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary).toBe('No conversation recorded.');
      expect(data.actionItems).toEqual([]);
    });

    it('should handle Gemini API error', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      
      mockGenerateContent.mockRejectedValue(new Error('Gemini API error'));
      
      const { POST } = await import('@/app/api/chat/summarize/route');
      const req = createMockRequest('/api/chat/summarize', 'POST', { transcript: mockTranscript, theme: mockTheme });
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal Server Error');
    });

    it('should handle invalid JSON response from Gemini', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      
      const mockResponse = {
        response: {
          text: vi.fn().mockReturnValue('Invalid JSON response'),
        },
      };
      
      mockGenerateContent.mockResolvedValue(mockResponse);
      
      const { POST } = await import('@/app/api/chat/summarize/route');
      const req = createMockRequest('/api/chat/summarize', 'POST', { transcript: mockTranscript, theme: mockTheme });
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal Server Error');
    });

    it('should handle malformed transcript items', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      
      const mockResponse = {
        response: {
          text: vi.fn().mockReturnValue(JSON.stringify({
            summary: 'Summary of conversation',
            actionItems: ['Follow up'],
          })),
        },
      };
      
      mockGenerateContent.mockResolvedValue(mockResponse);
      
      const { POST } = await import('@/app/api/chat/summarize/route');
      // Transcript with missing speaker or text fields
      const malformedTranscript = [
        { speaker: 'manager' }, // Missing text
        { text: 'Some text' }, // Missing speaker
        null, // null entry
        { speaker: 'subordinate', text: 'Valid entry' },
      ];

      const req = createMockRequest('/api/chat/summarize', 'POST', { transcript: malformedTranscript, theme: 'Test' });
      
      const response = await POST(req);
      
      // Should still process (API handles missing fields gracefully)
      // The actual implementation uses transcript.map which will fail on null
      // This test documents the current behavior
      expect(response.status).toBe(500); // Will fail due to null entry
    });
  });
});