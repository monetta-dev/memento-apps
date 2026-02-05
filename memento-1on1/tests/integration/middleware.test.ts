import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { middleware } from '@/middleware';
import { NextRequest, NextResponse } from 'next/server';

// Mock @supabase/ssr
const { mockCreateServerClient, mockGetUser } = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  const mockCreateServerClient = vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  }));
  return { mockCreateServerClient, mockGetUser };
});

vi.mock('@supabase/ssr', () => ({
  createServerClient: mockCreateServerClient,
}));

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    next: vi.fn(() => ({
      cookies: {
        set: vi.fn(),
      },
    })),
    redirect: vi.fn(),
  },
  NextRequest: class MockNextRequest {
    url: string;
    nextUrl: URL;
    private _cookies: Map<string, string>;
    
    constructor(url: string) {
      this.url = url;
      this._cookies = new Map();
      this.nextUrl = new URL(url);
    }
    
    get cookies() {
      return {
        getAll: () => Array.from(this._cookies.entries()).map(([name, value]) => ({ name, value })),
        set: (name: string, value: string) => {
          this._cookies.set(name, value);
        },
      };
    }
  },
}));

describe('middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    
    // Default mock implementations
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    
    // Mock NextResponse.next to return a mock response
    (NextResponse.next as vi.Mock).mockReturnValue({
      cookies: {
        set: vi.fn(),
      },
    });
    
    // Mock NextResponse.redirect
    (NextResponse.redirect as vi.Mock).mockImplementation((url: string) => ({
      url,
      status: 302,
    }));
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create Supabase client with environment variables', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    
    const request = new NextRequest('http://localhost:3000/');
    await middleware(request);
    
    expect(mockCreateServerClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({
        cookies: expect.any(Object),
      })
    );
  });

  it('should allow access to public routes without authentication', async () => {
    const request = new NextRequest('http://localhost:3000/login');
    await middleware(request);
    
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    // Should proceed with NextResponse.next()
    expect(NextResponse.next).toHaveBeenCalled();
  });

  it('should redirect unauthenticated users from protected routes to login', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    
    const request = new NextRequest('http://localhost:3000/');
    await middleware(request);
    
    expect(NextResponse.redirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'http://localhost:3000/login?redirect=%2F' })
    );
  });

  it('should allow authenticated users to access protected routes', async () => {
    mockGetUser.mockResolvedValue({ 
      data: { 
        user: { id: '123', email: 'test@example.com' } 
      }, 
      error: null 
    });
    
    const request = new NextRequest('http://localhost:3000/');
    await middleware(request);
    
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(NextResponse.next).toHaveBeenCalled();
  });

  it('should redirect authenticated users away from auth routes to home', async () => {
    mockGetUser.mockResolvedValue({ 
      data: { 
        user: { id: '123', email: 'test@example.com' } 
      }, 
      error: null 
    });
    
    const request = new NextRequest('http://localhost:3000/login');
    await middleware(request);
    
    expect(NextResponse.redirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'http://localhost:3000/' })
    );
  });



  it('should handle getUser error gracefully', async () => {
    mockGetUser.mockResolvedValueOnce({ 
      data: { user: null }, 
      error: new Error('Auth error') 
    });
    
    const request = new NextRequest('http://localhost:3000/');
    await middleware(request);
    
    // Should still redirect to login since user is null
    expect(NextResponse.redirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'http://localhost:3000/login?redirect=%2F' })
    );
  });

  it('should handle nested protected routes', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    
    const request = new NextRequest('http://localhost:3000/session/123');
    await middleware(request);
    
    expect(NextResponse.redirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'http://localhost:3000/login?redirect=%2Fsession%2F123' })
    );
  });

  describe.skip('cookie handling', () => {
    it('should set cookies with proper options for localhost', async () => {
      const request = new NextRequest('http://localhost:3000/');
      request.cookies.set('test-cookie', 'value');
      
      await middleware(request);
      
      // Should call cookies.set with proper options
      const response = (NextResponse.next as vi.Mock).mock.results[0]?.value;
      expect(response?.cookies.set).toHaveBeenCalled();
    });

    it('should set cookies with proper options for production', async () => {
      const request = new NextRequest('https://example.com/');
      request.cookies.set('test-cookie', 'value');
      
      await middleware(request);
      
      // Should call cookies.set with proper options
      const response = (NextResponse.next as vi.Mock).mock.results[0]?.value;
      expect(response?.cookies.set).toHaveBeenCalled();
    });
  });
});