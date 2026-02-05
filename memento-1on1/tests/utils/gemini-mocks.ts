import { vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Creates mocks for Google Generative AI SDK
 * Returns an object with mocks that can be used in tests
 */
export function setupGeminiMocks() {
  const mockGenerateContent = vi.fn();
  const mockGetGenerativeModel = vi.fn(() => ({
    generateContent: mockGenerateContent,
  }));
  const mockGoogleGenerativeAI = vi.fn(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  }));

  // Mock the GoogleGenerativeAI class
  vi.doMock('@google/generative-ai', () => ({
    GoogleGenerativeAI: mockGoogleGenerativeAI,
  }));

  return {
    mockGenerateContent,
    mockGetGenerativeModel,
    mockGoogleGenerativeAI,
  };
}

/**
 * Resets environment variables before/after tests
 */
export function withEnvReset() {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  return { originalEnv };
}

// Mock NextRequest with formData support
export class MockNextRequest extends NextRequest {
  private _formData: FormData;

  constructor(url: string, init?: RequestInit) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { body, signal: _, ...restInit } = init || {};
    super(url, { ...restInit, body });
    // If body is FormData, store it
    if (body instanceof FormData) {
      this._formData = body;
    } else {
      this._formData = new FormData();
    }
  }

  async formData(): Promise<FormData> {
    return this._formData;
  }
}

/**
 * Creates a mock NextRequest for API testing
 */
export function createMockRequest(
  path: string,
  method: 'POST' | 'GET' | 'PUT' | 'DELETE' = 'POST',
  body?: unknown,
  headers: Record<string, string> = {}
) {
  const url = `http://localhost:3000${path}`;
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body) {
    if (body instanceof FormData) {
      init.body = body;
    } else {
      init.body = JSON.stringify(body);
    }
  }

  return new MockNextRequest(url, init);
}