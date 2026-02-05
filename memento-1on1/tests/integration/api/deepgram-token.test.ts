import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/deepgram/token/route';

describe('API: /api/deepgram/token', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('GET', () => {
    it('should return mock mode when DEEPGRAM_API_KEY is not configured', async () => {
      delete process.env.DEEPGRAM_API_KEY;

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.mockMode).toBe(true);
      expect(data.error).toBe('Deepgram API Key not configured');
    });

    it('should return temporary token when API key is configured', async () => {
      process.env.DEEPGRAM_API_KEY = 'test-api-key';
      
      // Mock fetch response
      const mockToken = 'test-jwt-token';
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          access_token: mockToken, 
          expires_in: 3600 
        }),
      });

      const response = await GET();
      const data = await response.json();

      expect(fetch).toHaveBeenCalledWith('https://api.deepgram.com/v1/auth/grant', {
        method: 'POST',
        headers: {
          'Authorization': 'Token test-api-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl_seconds: 3600 }),
        signal: expect.any(AbortSignal),
      });

      expect(response.status).toBe(200);
      expect(data.key).toBe(mockToken);
      expect(data.expiresIn).toBe(3600);
      expect(data.mockMode).toBe(false);
    });

    it('should handle Deepgram API error', async () => {
      process.env.DEEPGRAM_API_KEY = 'test-api-key';
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.mockMode).toBe(true);
      expect(data.error).toBe('Failed to generate temporary token');
    });

    it('should handle network error', async () => {
      process.env.DEEPGRAM_API_KEY = 'test-api-key';
      
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.mockMode).toBe(true);
      expect(data.error).toBe('Failed to generate temporary token');
    });

    it('should handle missing access_token in response', async () => {
      process.env.DEEPGRAM_API_KEY = 'test-api-key';
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          expires_in: 3600 
          // Missing access_token
        }),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.mockMode).toBe(true);
      expect(data.error).toBe('Failed to generate temporary token');
    });
  });
});