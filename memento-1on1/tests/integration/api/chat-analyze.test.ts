import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupGeminiMocks, withEnvReset, createMockRequest } from '@/tests/utils/gemini-mocks';

describe('API: /api/chat/analyze', () => {
  withEnvReset();
  let mockGenerateContent: ReturnType<typeof vi.fn>;
  let mockGetGenerativeModel: ReturnType<typeof vi.fn>;
  let mockGoogleGenerativeAI: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Setup Gemini mocks
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
    const mockSubordinateTraits = ['Analytical', 'Detail-oriented'];

    it('should return 400 error when transcript is missing', async () => {
      const { POST } = await import('@/app/api/chat/analyze/route');
      const req = createMockRequest('/api/chat/analyze', 'POST', { theme: 'test', subordinateTraits: mockSubordinateTraits });
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No valid transcript provided');
    });

    it('should return 400 error when transcript is not an array', async () => {
      const { POST } = await import('@/app/api/chat/analyze/route');
      const req = createMockRequest('/api/chat/analyze', 'POST', { transcript: 'not-an-array', theme: 'test', subordinateTraits: mockSubordinateTraits });
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No valid transcript provided');
    });

    it('should return mock advice when GEMINI_API_KEY is not configured', async () => {
      delete process.env.GEMINI_API_KEY;
      const { POST } = await import('@/app/api/chat/analyze/route');
      
      const req = createMockRequest('/api/chat/analyze', 'POST', { transcript: mockTranscript, theme: mockTheme, subordinateTraits: mockSubordinateTraits });
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.advice).toBe('The subordinate seems hesitant. (Mock Advice: Set GEMINI_API_KEY)');
      expect(data.status).toBe('success');
      
      // Should not call Google Generative AI
      expect(mockGoogleGenerativeAI).not.toHaveBeenCalled();
    });

    it('should return AI advice when GEMINI_API_KEY is configured', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      
      // Mock Gemini API response
      const mockResponse = {
        response: {
          text: vi.fn().mockReturnValue('Ask more open-ended questions to encourage deeper sharing.'),
        },
      };
      
      mockGenerateContent.mockResolvedValue(mockResponse);
      
      const { POST } = await import('@/app/api/chat/analyze/route');
      const req = createMockRequest('/api/chat/analyze', 'POST', { transcript: mockTranscript, theme: mockTheme, subordinateTraits: mockSubordinateTraits });
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.advice).toBe('Ask more open-ended questions to encourage deeper sharing.');
      expect(data.status).toBe('success');
      
      // Verify Gemini API was called correctly
      expect(mockGoogleGenerativeAI).toHaveBeenCalledWith('test-api-key');
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-2.0-flash',
      });
      
      // Check that prompt includes transcript, theme, and traits
      expect(mockGenerateContent).toHaveBeenCalled();
      const promptArgs = mockGenerateContent.mock.calls[0][0];
      // generateContent is called with an array [systemPrompt, userMessage]
      expect(Array.isArray(promptArgs)).toBe(true);
      expect(promptArgs).toHaveLength(2);
      const systemPrompt = promptArgs[0];
      const userMessage = promptArgs[1];
      expect(systemPrompt).toContain('Current 1on1 Theme: "Project Progress"');
      expect(systemPrompt).toContain('Subordinate Traits: Analytical, Detail-oriented');
      expect(userMessage).toContain('manager: How are things going with the project?');
      expect(userMessage).toContain('subordinate: It\'s going well, we\'re on track for the deadline.');
    });

    it('should handle empty transcript array', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      
      const mockResponse = {
        response: {
          text: vi.fn().mockReturnValue('No conversation to analyze.'),
        },
      };
      
      mockGenerateContent.mockResolvedValue(mockResponse);
      
      const { POST } = await import('@/app/api/chat/analyze/route');
      const req = createMockRequest('/api/chat/analyze', 'POST', { transcript: [], theme: 'Empty Meeting', subordinateTraits: mockSubordinateTraits });
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.advice).toBe('No conversation to analyze.');
      expect(data.status).toBe('success');
    });

    it('should handle Gemini API error', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      
      mockGenerateContent.mockRejectedValue(new Error('Gemini API error'));
      
      const { POST } = await import('@/app/api/chat/analyze/route');
      const req = createMockRequest('/api/chat/analyze', 'POST', { transcript: mockTranscript, theme: mockTheme, subordinateTraits: mockSubordinateTraits });
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal Server Error');
    });

    it('should handle missing subordinateTraits', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      
      const mockResponse = {
        response: {
          text: vi.fn().mockReturnValue('Advice text'),
        },
      };
      
      mockGenerateContent.mockResolvedValue(mockResponse);
      
      const { POST } = await import('@/app/api/chat/analyze/route');
      const req = createMockRequest('/api/chat/analyze', 'POST', { transcript: mockTranscript, theme: mockTheme });
      // subordinateTraits is optional
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.advice).toBe('Advice text');
      expect(data.status).toBe('success');
    });

    it('should handle missing theme', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      
      const mockResponse = {
        response: {
          text: vi.fn().mockReturnValue('Advice text'),
        },
      };
      
      mockGenerateContent.mockResolvedValue(mockResponse);
      
      const { POST } = await import('@/app/api/chat/analyze/route');
      const req = createMockRequest('/api/chat/analyze', 'POST', { transcript: mockTranscript, subordinateTraits: mockSubordinateTraits });
      // theme is optional (defaults to 'General Check-in')
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.advice).toBe('Advice text');
      expect(data.status).toBe('success');
    });
  });
});