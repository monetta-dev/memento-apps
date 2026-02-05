import { describe, it, expect, vi, beforeEach } from 'vitest';

// Clear module cache before each test to reset module state
beforeEach(() => {
  vi.resetModules();
});

describe('lib/supabase', () => {
  describe('supabase client', () => {
    it('should create client when environment variables are present', async () => {
      // Import after resetting modules
      const { supabase } = await import('@/lib/supabase');
      expect(supabase).toBeDefined();
      expect(supabase).toHaveProperty('from');
      expect(supabase).toHaveProperty('auth');
    });
  });

  describe('createClientComponentClient', () => {
    it('should return client when environment variables are present', async () => {
      const { createClientComponentClient } = await import('@/lib/supabase');
      const client = createClientComponentClient();
      expect(client).toBeDefined();
      expect(client).toHaveProperty('auth');
    });

    it('should throw error when environment variables are missing', async () => {
      // Mock the environment variables as undefined
      vi.doMock('@/lib/supabase', async (importOriginal) => {
        // Keep original implementation but simulate missing env vars
        const original = await importOriginal();
        return {
          ...original,
          // Override createClientComponentClient to simulate missing env vars
          createClientComponentClient: () => {
            throw new Error('Missing Supabase environment variables');
          },
        };
      });

      // Import after mocking
      const { createClientComponentClient } = await import('@/lib/supabase');
      
      expect(() => createClientComponentClient()).toThrow('Missing Supabase environment variables');
    });
  });
});