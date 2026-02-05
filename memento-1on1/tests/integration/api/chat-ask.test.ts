import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupGeminiMocks, withEnvReset, createMockRequest } from '@/tests/utils/gemini-mocks';

describe('API: /api/chat/ask', () => {
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
      { speaker: 'manager', text: 'プロジェクトの進捗はどうですか？' },
      { speaker: 'subordinate', text: '順調です。期限に間に合う見込みです。' },
      { speaker: 'manager', text: '何か課題や懸念事項はありますか？' },
      { speaker: 'subordinate', text: 'APIの要件についてもっと明確にしたいです。' },
    ];

    const mockTheme = 'プロジェクト進捗状況の確認';
    const mockSubordinateTraits = ['分析的', '詳細志向'];

    it('should return 400 error when transcript is missing', async () => {
      const { POST } = await import('@/app/api/chat/ask/route');
      const req = createMockRequest('/api/chat/ask', 'POST', { 
        theme: mockTheme, 
        subordinateTraits: mockSubordinateTraits,
        question: 'テーマは何ですか？'
      });
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No valid transcript provided');
    });

    it('should return 400 error when transcript is not an array', async () => {
      const { POST } = await import('@/app/api/chat/ask/route');
      const req = createMockRequest('/api/chat/ask', 'POST', { 
        transcript: 'not-an-array', 
        theme: mockTheme, 
        subordinateTraits: mockSubordinateTraits,
        question: 'テーマは何ですか？'
      });
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No valid transcript provided');
    });

    it('should return 400 error when question is missing', async () => {
      const { POST } = await import('@/app/api/chat/ask/route');
      const req = createMockRequest('/api/chat/ask', 'POST', { 
        transcript: mockTranscript, 
        theme: mockTheme, 
        subordinateTraits: mockSubordinateTraits
      });
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No valid question provided');
    });

    it('should return 400 error when question is not a string', async () => {
      const { POST } = await import('@/app/api/chat/ask/route');
      const req = createMockRequest('/api/chat/ask', 'POST', { 
        transcript: mockTranscript, 
        theme: mockTheme, 
        subordinateTraits: mockSubordinateTraits,
        question: 123
      });
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No valid question provided');
    });

    it('should return mock answer when GEMINI_API_KEY is not set', async () => {
      process.env.GEMINI_API_KEY = '';
      
      const { POST } = await import('@/app/api/chat/ask/route');
      const req = createMockRequest('/api/chat/ask', 'POST', { 
        transcript: mockTranscript, 
        theme: mockTheme, 
        subordinateTraits: mockSubordinateTraits,
        question: 'テーマは何ですか？'
      });
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.answer).toContain('mock answer');
      expect(data.status).toBe('success');
    });

    describe('with valid Gemini API key', () => {
      beforeEach(() => {
        process.env.GEMINI_API_KEY = 'test-key';
      });

      it('should handle fact-checking questions about theme', async () => {
        const { POST } = await import('@/app/api/chat/ask/route');
        const req = createMockRequest('/api/chat/ask', 'POST', { 
          transcript: mockTranscript, 
          theme: mockTheme, 
          subordinateTraits: mockSubordinateTraits,
          question: '今回の会議のテーマは何ですか？'
        });

        // Mock Gemini response
        mockGenerateContent.mockResolvedValueOnce({
          response: {
            text: () => 'テーマはプロジェクト進捗状況の確認です。'
          }
        });

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.answer).toBe('テーマはプロジェクト進捗状況の確認です。');
        expect(data.status).toBe('success');

        // Verify the prompt was constructed correctly
        expect(mockGenerateContent).toHaveBeenCalled();
        const prompt = mockGenerateContent.mock.calls[0][0].join('');
        expect(prompt).toContain(mockTheme);
        expect(prompt).toContain('事実確認の質問');
      });

      it('should handle interpretation questions', async () => {
        const { POST } = await import('@/app/api/chat/ask/route');
        const req = createMockRequest('/api/chat/ask', 'POST', { 
          transcript: mockTranscript, 
          theme: mockTheme, 
          subordinateTraits: mockSubordinateTraits,
          question: '部下の気持ちはどうですか？'
        });

        // Mock Gemini response
        mockGenerateContent.mockResolvedValueOnce({
          response: {
            text: () => '部下はプロジェクトに前向きですが、API要件について明確化を求めています。'
          }
        });

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.answer).toBe('部下はプロジェクトに前向きですが、API要件について明確化を求めています。');
        expect(data.status).toBe('success');
      });

      it('should handle advice-request questions', async () => {
        const { POST } = await import('@/app/api/chat/ask/route');
        const req = createMockRequest('/api/chat/ask', 'POST', { 
          transcript: mockTranscript, 
          theme: mockTheme, 
          subordinateTraits: mockSubordinateTraits,
          question: 'どうすればもっと良い聞き手になれますか？'
        });

        // Mock Gemini response
        mockGenerateContent.mockResolvedValueOnce({
          response: {
            text: () => '部下の話を最後まで聞き、要約して確認しましょう。'
          }
        });

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.answer).toBe('部下の話を最後まで聞き、要約して確認しましょう。');
        expect(data.status).toBe('success');
      });

      it('should handle empty transcript gracefully', async () => {
        const { POST } = await import('@/app/api/chat/ask/route');
        const req = createMockRequest('/api/chat/ask', 'POST', { 
          transcript: [], 
          theme: mockTheme, 
          subordinateTraits: mockSubordinateTraits,
          question: 'テーマは何ですか？'
        });

        // Mock Gemini response
        mockGenerateContent.mockResolvedValueOnce({
          response: {
            text: () => 'テーマはプロジェクト進捗状況の確認です。'
          }
        });

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.answer).toBe('テーマはプロジェクト進捗状況の確認です。');
        expect(data.status).toBe('success');
      });

      it('should handle missing theme gracefully', async () => {
        const { POST } = await import('@/app/api/chat/ask/route');
        const req = createMockRequest('/api/chat/ask', 'POST', { 
          transcript: mockTranscript, 
          theme: '', 
          subordinateTraits: mockSubordinateTraits,
          question: 'テーマは何ですか？'
        });

        // Mock Gemini response - should extract from transcript or say unknown
        mockGenerateContent.mockResolvedValueOnce({
          response: {
            text: () => 'トランスクリプトから、テーマはプロジェクト進捗に関する議論と推測されます。'
          }
        });

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.answer).toBe('トランスクリプトから、テーマはプロジェクト進捗に関する議論と推測されます。');
        expect(data.status).toBe('success');
      });

      it('should return error when Gemini API fails', async () => {
        const { POST } = await import('@/app/api/chat/ask/route');
        const req = createMockRequest('/api/chat/ask', 'POST', { 
          transcript: mockTranscript, 
          theme: mockTheme, 
          subordinateTraits: mockSubordinateTraits,
          question: 'テーマは何ですか？'
        });

        // Mock Gemini error
        mockGenerateContent.mockRejectedValueOnce(new Error('API Error'));

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Internal Server Error');
      });
    });
  });
});