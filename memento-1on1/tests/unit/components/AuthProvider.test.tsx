import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '@/components/AuthProvider';
import React from 'react';

// Mock Supabase auth
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockGetSession = vi.fn();

const mockSupabaseClient = {
  auth: {
    signInWithPassword: mockSignInWithPassword,
    signUp: mockSignUp,
    signOut: mockSignOut,
    signInWithOAuth: mockSignInWithOAuth,
    onAuthStateChange: mockOnAuthStateChange,
    getSession: mockGetSession,
  },
};

// Mock createClientComponentClient and getOAuthRedirectUrl
vi.mock('@/lib/supabase', () => ({
  createClientComponentClient: vi.fn(() => mockSupabaseClient),
  getOAuthRedirectUrl: vi.fn(() => {
    // Simulate the function behavior in test environment
    // Always return a valid URL for tests
    return 'http://localhost:3000/auth/callback';
  }),
}));

// Test component that uses the auth context
function TestComponent() {
  const auth = useAuth();
  
  return (
    <div>
      <div data-testid="user-email">{auth.user?.email || 'no-user'}</div>
      <div data-testid="is-loading">{auth.isLoading.toString()}</div>
      <button onClick={() => auth.signIn('test@example.com', 'password')}>Sign In</button>
      <button onClick={() => auth.signUp('test@example.com', 'password', 'Test User')}>Sign Up</button>
      <button onClick={() => auth.signOut()}>Sign Out</button>
      <button onClick={() => auth.signInWithGoogle()}>Google Sign In</button>
    </div>
  );
}

describe('AuthProvider', () => {
  const user = userEvent.setup();
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockSignUp.mockResolvedValue({ data: { user: { id: '123', email: 'test@example.com' } }, error: null });
    mockSignOut.mockResolvedValue({ error: null });
    mockSignInWithOAuth.mockResolvedValue({ data: { url: 'https://google.com' }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockImplementation((callback) => {
      // Store callback for later invocation in tests
      callback('INITIAL_SESSION', null);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
  });

  it('should provide auth context with initial state', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('no-user');
    });
  });

  it('should handle sign in successfully', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await user.click(screen.getByText('Sign In'));
    
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password',
    });
  });

  it('should handle sign in error', async () => {
    const mockError = new Error('Invalid credentials');
    mockSignInWithPassword.mockResolvedValueOnce({ error: mockError });
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await user.click(screen.getByText('Sign In'));
    
    expect(mockSignInWithPassword).toHaveBeenCalled();
    // Note: In the actual component, errors are returned but not displayed
    // This test verifies the function is called correctly
  });

  it('should handle sign up successfully', async () => {
    mockSignUp.mockResolvedValueOnce({ 
      data: { 
        user: { 
          id: '123', 
          email: 'test@example.com' 
        } 
      }, 
      error: null 
    });
    
    // Mock profiles insert
    const mockFrom = vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ error: null })),
    }));
    mockSupabaseClient.from = mockFrom;

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await user.click(screen.getByText('Sign Up'));
    
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password',
      options: {
        data: {
          full_name: 'Test User',
        },
      },
    });
  });

  it('should handle sign out', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await user.click(screen.getByText('Sign Out'));
    
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should handle Google sign in', async () => {
    window.alert = vi.fn(); // Mock alert
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await user.click(screen.getByText('Google Sign In'));
    
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: expect.any(String),
        scopes: 'email profile https://www.googleapis.com/auth/calendar openid',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        skipBrowserRedirect: false,
      },
    });
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console error for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');
      
      consoleError.mockRestore();
    });
  });
});