import { createClient } from '@supabase/supabase-js';
import { Page } from '@playwright/test';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Make sure .env.test is loaded.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export interface TestUserCredentials {
  email: string;
  password: string;
  name: string;
}

export const TEST_USER: TestUserCredentials = {
  email: process.env.TEST_USER_EMAIL || 'test@memento-1on1.com',
  password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
  name: process.env.TEST_USER_NAME || 'Test User',
};

/**
 * Log in with email and password using Supabase client
 * Returns the session if successful
 */
export async function loginWithEmailPassword(
  email: string = TEST_USER.email,
  password: string = TEST_USER.password
) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`Login failed: ${error.message}`);
  }

  return data;
}

/**
 * Log out the current user
 */
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.warn('Logout error:', error.message);
  }
}

/**
 * Get the current session
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Failed to get session: ${error.message}`);
  }
  return data.session;
}

/**
 * Get the current user
 */
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(`Failed to get user: ${error.message}`);
  }
  return data.user;
}

/**
 * Check if a user exists by email
 */
export async function userExists(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('Error checking user existence:', error.message);
    return false;
  }

  return !!data;
}

/**
 * Create a test user if it doesn't exist
 * Note: This requires admin privileges or using the auth signUp API
 * For simplicity, we'll use signUp which will create the user
 */
export async function ensureTestUser() {
  // Check if user exists by trying to sign in
  try {
    await loginWithEmailPassword();
    console.log('Test user already exists and can log in');
    return true;
  } catch {
    // User doesn't exist or can't log in, try to sign up
    console.log('Test user not found, attempting to create...');
  }

  const { email, password, name } = TEST_USER;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
      },
    },
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  console.log('Test user created:', data.user?.email);
  return data.user;
}

/**
 * Clean up test user by deleting it
 * Note: This requires admin privileges. In test environment, we might not delete.
 */
export async function cleanupTestUser() {
  console.warn('User deletion requires admin privileges. Skipping cleanup.');
  // In a real test setup, you would use a service role client to delete the user
  // For now, we'll just log out
  await logout();
}

/**
 * Playwright helper: Log in via UI
 */
export async function loginViaUI(page: Page, email?: string, password?: string) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.getByPlaceholder('you@example.com').fill(email || TEST_USER.email);
  await page.getByPlaceholder('••••••••').fill(password || TEST_USER.password);
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();

  // Wait for navigation to dashboard
  await page.waitForURL('/');
  await expect(page.getByText('Start 1on1')).toBeVisible({ timeout: 10000 });
}

/**
 * Playwright helper: Log out via UI
 */
export async function logoutViaUI(page: Page) {
  // Assuming there's a logout button in the UI
  // This needs to be implemented based on actual UI
  await page.goto('/settings');
  await page.getByRole('button', { name: 'ログアウト' }).click();
  await page.waitForURL('/login');
}

// Re-export expect for convenience
import { expect } from '@playwright/test';
export { expect };