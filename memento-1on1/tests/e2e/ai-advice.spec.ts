import { test, expect } from '@playwright/test';
import { loginViaUI } from '../helpers/auth';

test.describe('AI Copilot Advice', () => {
  
  test.beforeEach(async ({ page }) => {
    // Log in with test user
    await loginViaUI(page);
  });

  test('AI Copilot shows advice section in session', async ({ page }) => {
    // 1. Start a session
    await expect(page.getByText('Start 1on1')).toBeVisible();
    await page.getByText('Start 1on1').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Fill form
    const subSelect = page.locator('#subordinateId');
    await subSelect.click();
    await page.locator('.ant-select-item-option').first().click();
    
    await page.fill('#theme', 'AI Advice Test Theme');
    
    // Start Session
    await page.getByText('Start Session', { exact: true }).click();
    
    // 2. Verify Session Page
    await expect(page).toHaveURL(/\/session\/[0-9a-f-]+/);
    await expect(page.getByText('AI Advice Test Theme')).toBeVisible();
    
    // 3. Check AI Copilot section exists
    await expect(page.getByText('AI Copilot')).toBeVisible({ timeout: 10000 });
    
    // Check for AI advice alert - it should show real-time advice
    await expect(page.getByText('Real-time Advice')).toBeVisible({ timeout: 5000 });
    
    // Find the specific AI advice alert (not the Next.js route announcer)
    const aiAlert = page.getByRole('alert').filter({ hasText: 'Real-time Advice' });
    await expect(aiAlert).toBeVisible({ timeout: 5000 });
    
    // The alert should contain advice text
    await expect(aiAlert.getByText('Keep listening', { exact: false })).toBeVisible({ timeout: 5000 });
    
    // 4. Switch to MindMap and back to ensure AI section persists
    await page.getByRole('button', { name: 'Switch to MindMap' }).click();
    await expect(page.getByText('Add Topic')).toBeVisible();
    
    await page.getByRole('button', { name: 'Switch to Video' }).click();
    
    // 5. AI section should still be visible
    await expect(page.getByText('AI Copilot')).toBeVisible();
    
    // 6. End session
    await page.getByRole('button', { name: 'End Session' }).click();
    
    // 7. Verify summary page
    await expect(page).toHaveURL(/\/session\/[0-9a-f-]+\/summary/);
    await expect(page.getByText('Session Completed Successfully')).toBeVisible();
  });

  test('AI advice updates with mock response', async ({ page: _ }) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    // This test would mock the Gemini API response
    // For now, skip as it requires more complex setup
    test.skip();
  });

});