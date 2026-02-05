import { test, expect } from '@playwright/test';
import { loginViaUI } from '../helpers/auth';

test.describe('Face-to-Face Mode', () => {
  
  test.beforeEach(async ({ page }) => {
    // Log in with test user
    await loginViaUI(page);
    await page.getByText('Start 1on1').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Fill form and start session
    const subSelect = page.locator('#subordinateId');
    await subSelect.click();
    await page.locator('.ant-select-item-option').first().click();
    
    await page.fill('#theme', 'Face-to-Face Test');
    await page.getByText('Start Session', { exact: true }).click();
    
    // Verify session page
    await expect(page).toHaveURL(/\/session\/[0-9a-f-]+/);
    await page.waitForLoadState('networkidle');
    // Wait for session data to load
    await expect(page.getByText('Loading session data...')).toBeHidden({ timeout: 10000 });
    await expect(page.getByText('Face-to-Face Test')).toBeVisible({ timeout: 10000 });
  });

  test('LiveKit component loads in session page', async ({ page }) => {
    // LiveKit component should load (may show mock mode if no API key)
    // Check for either real LiveKit or mock mode
    
    // Look for video conference area or mock message
    const videoArea = page.locator('[data-lk-theme="default"]').or(page.getByText('LiveKit Config Missing')).or(page.getByText('Connecting to LiveKit'));
    await expect(videoArea).toBeVisible({ timeout: 10000 });
    
    // Should have control bar or some LiveKit UI
    await expect(page.locator('.lk-control-bar').or(page.getByText('Mock Mode Active'))).toBeVisible({ timeout: 5000 });
    
    // Check that the session has video controls
    await expect(page.getByRole('button', { name: 'End Session' })).toBeVisible();
  });

  test('Video controls are present in session', async ({ page }) => {
    // Test assumes face-to-face mode may have different controls
    // Since we can't test actual WebRTC, verify UI elements exist
    
    // Look for LiveKit controls or mock UI
    const hasLiveKitControls = await page.locator('.lk-control-bar').isVisible().catch(() => false);
    const hasMockMode = await page.getByText('Mock Mode Active').isVisible().catch(() => false);
    
    // At least one should be true
    expect(hasLiveKitControls || hasMockMode).toBeTruthy();
    
    // Check for standard session controls
    await expect(page.getByRole('button', { name: 'Switch to MindMap' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'End Session' })).toBeVisible();
  });

});