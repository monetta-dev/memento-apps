import { test, expect } from '@playwright/test';
import { loginViaUI } from '../helpers/auth';

test.describe('LINE Connect Debug', () => {
  test.beforeEach(async ({ page }) => {
    // Log in with test user and navigate to settings
    await loginViaUI(page);
    await page.goto('/settings');
  });

  test('LINE connect button should return OAuth URL', async ({ page }) => {
    // Listen for network response from /api/line/connect
    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/line/connect') && resp.request().method() === 'POST'),
      // Click the LINE connect button
      page.getByRole('button', { name: '接続' }).nth(1).click(),
    ]);

    // Log response details
    console.log('Response status:', response.status());
    console.log('Response headers:', response.headers());
    const body = await response.json();
    console.log('Response body:', body);

    // Verify response contains oauthUrl
    expect(response.ok()).toBeTruthy();
    expect(body.success).toBe(true);
    expect(body.oauthUrl).toBeTruthy();
    expect(body.oauthUrl).toContain('https://access.line.me/oauth2/v2.1/authorize');

    // Check if frontend attempted redirect (we can't directly test because page will navigate away)
    // Instead, we can check that window.location.href was set by listening for console logs
    // We'll capture console logs from the page
    const logs: string[] = [];
    page.on('console', msg => {
      logs.push(msg.text());
    });

    // Wait a bit for any console logs
    await page.waitForTimeout(1000);

    // Print captured logs
    console.log('Console logs:', logs);
  });
});