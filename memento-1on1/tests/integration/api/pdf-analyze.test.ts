import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupGeminiMocks, withEnvReset, MockNextRequest } from '../../utils/gemini-mocks';

describe('API: /api/pdf/analyze', () => {
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

  const createMockRequest = (file?: File, subordinateId?: string) => {
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    }
    if (subordinateId) {
      formData.append('subordinateId', subordinateId);
    }
    
    return new MockNextRequest('http://localhost:3000/api/pdf/analyze', {
      method: 'POST',
      body: formData,
    });
  };

  // Mock File constructor
  class MockFile extends File {
    private _content: string[];
    
    constructor(content: string[], name: string, options: { type: string }) {
      super(content, name, options);
      this._content = content;
    }
    
    // Override arrayBuffer to ensure consistent behavior
    async arrayBuffer(): Promise<ArrayBuffer> {
      const text = this._content.join('');
      return new TextEncoder().encode(text).buffer;
    }
    
    // Override text to ensure consistent behavior
    async text(): Promise<string> {
      return this._content.join('');
    }
  }



  describe('POST', () => {
    it('should return 400 error when no file is provided', async () => {
      const { POST } = await import('@/app/api/pdf/analyze/route');
      const req = createMockRequest();
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No file provided');
    });

    it('should return 400 error when file is not a PDF', async () => {
      const { POST } = await import('@/app/api/pdf/analyze/route');
      const file = new MockFile(['fake pdf content'], 'test.pdf', { type: 'application/pdf' }) as File;
      const req = createMockRequest(file);
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('File must be a PDF');
    });

    it('should return error when GEMINI_API_KEY is not configured', async () => {
      delete process.env.GEMINI_API_KEY;
      const { POST } = await import('@/app/api/pdf/analyze/route');
      const file = new MockFile(['fake pdf content'], 'test.pdf', { type: 'application/pdf' }) as File;
      const req = createMockRequest(file);
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Gemini API Key not configured');
      expect(data.traits).toEqual(['Analytical', 'Communicative']); // Mock fallback
      
      // Should not call Google Generative AI
      expect(mockGoogleGenerativeAI).not.toHaveBeenCalled();
    });

    it('should return analyzed traits when PDF is valid and API key is configured', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      
      // Mock Gemini API response
      const mockResponse = {
        response: {
          text: vi.fn().mockReturnValue('["Analytical", "Detail-oriented", "Collaborative"]'),
        },
      };
      
      mockGenerateContent.mockResolvedValue(mockResponse);
      
      const { POST } = await import('@/app/api/pdf/analyze/route');
      const file = new MockFile(['fake pdf content'], 'test.pdf', { type: 'application/pdf' }) as File;
      const req = createMockRequest(file, 'sub-123');
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.traits).toEqual(['Analytical', 'Detail-oriented', 'Collaborative']);
      expect(data.originalText).toBeDefined();
      
      // Verify Gemini API was called correctly
      expect(mockGoogleGenerativeAI).toHaveBeenCalledWith('test-api-key');
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-2.0-flash',
      });
      
      // Check that prompt includes PDF analysis instructions
      expect(mockGenerateContent).toHaveBeenCalled();
      const args = mockGenerateContent.mock.calls[0][0];
      expect(Array.isArray(args)).toBe(true);
      expect(args).toHaveLength(2);
      const prompt = args[0];
      expect(prompt).toContain('You are an expert HR analyst');
      expect(prompt).toContain('Return ONLY a JSON array of strings representing the extracted traits');
    });

    it('should handle JSON parse error and fallback to text parsing', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      
      // Mock Gemini API response with non-JSON text
      const mockResponse = {
        response: {
          text: vi.fn().mockReturnValue('Analytical, Detail-oriented, Collaborative'),
        },
      };
      
      mockGenerateContent.mockResolvedValue(mockResponse);
      
      const { POST } = await import('@/app/api/pdf/analyze/route');
      const file = new MockFile(['fake pdf content'], 'test.pdf', { type: 'application/pdf' }) as File;
      const req = createMockRequest(file);
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.traits).toEqual(['Analytical', 'Detail-oriented', 'Collaborative']);
    });

    it('should limit traits to 10 items', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      
      // Mock Gemini API response with many traits
      const manyTraits = Array.from({ length: 15 }, (_, i) => `Trait${i + 1}`);
      const mockResponse = {
        response: {
          text: vi.fn().mockReturnValue(JSON.stringify(manyTraits)),
        },
      };
      
      mockGenerateContent.mockResolvedValue(mockResponse);
      
      const { POST } = await import('@/app/api/pdf/analyze/route');
      const file = new MockFile(['fake pdf content'], 'test.pdf', { type: 'application/pdf' }) as File;
      const req = createMockRequest(file);
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.traits).toHaveLength(10);
      expect(data.traits).toEqual(manyTraits.slice(0, 10));
    });

    it('should handle Gemini API error', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      
      mockGenerateContent.mockRejectedValue(new Error('Gemini API error'));
      
      const { POST } = await import('@/app/api/pdf/analyze/route');
      const file = new MockFile(['fake pdf content'], 'test.pdf', { type: 'application/pdf' }) as File;
      const req = createMockRequest(file);
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to analyze PDF');
      expect(data.traits).toEqual(['Analytical', 'Communicative']); // Mock fallback
    });

    it('should handle invalid JSON array response', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      
      // Mock Gemini API response with JSON but not an array
      const mockResponse = {
        response: {
          text: vi.fn().mockReturnValue('{"traits": ["Analytical"]}'),
        },
      };
      
      mockGenerateContent.mockResolvedValue(mockResponse);
      
      const { POST } = await import('@/app/api/pdf/analyze/route');
      const file = new MockFile(['fake pdf content'], 'test.pdf', { type: 'application/pdf' }) as File;
      const req = createMockRequest(file);
      
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Should fallback to text parsing and extract traits
      expect(data.traits).toEqual(['{"traits": ["Analytical"]}']); // JSON object split by comma returns single element
    });
  });
});