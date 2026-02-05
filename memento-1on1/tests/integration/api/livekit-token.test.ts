import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/livekit/token/route';
import { NextRequest } from 'next/server';

// Mock livekit-server-sdk
vi.mock('livekit-server-sdk', () => ({
  AccessToken: vi.fn().mockImplementation(() => ({
    addGrant: vi.fn(),
    toJwt: vi.fn().mockResolvedValue('mock-jwt-token'),
  })),
}));

describe('API: /api/livekit/token', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createMockRequest = (room?: string, username?: string) => {
    const url = new URL('http://localhost:3000/api/livekit/token');
    if (room) url.searchParams.set('room', room);
    if (username) url.searchParams.set('username', username);
    
    return new NextRequest(url);
  };

  describe('GET', () => {
    it('should return 400 error when room is missing', async () => {
      const req = createMockRequest(undefined, 'test-user');
      
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing "room" or "username"');
    });

    it('should return 400 error when username is missing', async () => {
      const req = createMockRequest('test-room', undefined);
      
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing "room" or "username"');
    });

    it('should return mock token when environment variables are not configured', async () => {
      const req = createMockRequest('test-room', 'test-user');
      
      // Clear LiveKit environment variables
      delete process.env.LIVEKIT_API_KEY;
      delete process.env.LIVEKIT_API_SECRET;
      delete process.env.NEXT_PUBLIC_LIVEKIT_URL;

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.token).toBe('mock-token-for-demo-purposes');
      expect(data.warning).toBe('Env vars not set. Using mock token.');
    });

    it('should return JWT token when environment variables are configured', async () => {
      process.env.LIVEKIT_API_KEY = 'test-api-key';
      process.env.LIVEKIT_API_SECRET = 'test-api-secret';
      process.env.NEXT_PUBLIC_LIVEKIT_URL = 'wss://test.livekit.cloud';

      const req = createMockRequest('test-room', 'test-user');
      
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.token).toBe('mock-jwt-token');
      
      // Verify AccessToken was created with correct parameters
      const { AccessToken } = await import('livekit-server-sdk');
      expect(AccessToken).toHaveBeenCalledWith('test-api-key', 'test-api-secret', {
        identity: 'test-user',
      });
      
      // Verify grant was added
      const mockInstance = (AccessToken as vi.Mock).mock.results[0].value;
      expect(mockInstance.addGrant).toHaveBeenCalledWith({
        roomJoin: true,
        room: 'test-room',
      });
      expect(mockInstance.toJwt).toHaveBeenCalled();
    });

    it('should handle special characters in room and username', async () => {
      process.env.LIVEKIT_API_KEY = 'test-api-key';
      process.env.LIVEKIT_API_SECRET = 'test-api-secret';
      process.env.NEXT_PUBLIC_LIVEKIT_URL = 'wss://test.livekit.cloud';

      const req = createMockRequest('room-with-spaces-and-日本語', 'user@example.com');
      
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.token).toBe('mock-jwt-token');
      
      const { AccessToken } = await import('livekit-server-sdk');
      expect(AccessToken).toHaveBeenCalledWith('test-api-key', 'test-api-secret', {
        identity: 'user@example.com',
      });
      
      const mockInstance = (AccessToken as vi.Mock).mock.results[0].value;
      expect(mockInstance.addGrant).toHaveBeenCalledWith({
        roomJoin: true,
        room: 'room-with-spaces-and-日本語',
      });
    });
  });
});