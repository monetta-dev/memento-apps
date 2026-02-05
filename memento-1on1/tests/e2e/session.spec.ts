import { test, expect } from '@playwright/test';
import { loginViaUI } from '../helpers/auth';

test.describe('1on1 Session Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    // Log in with test user
    await loginViaUI(page);
    
    // Capture console logs for debugging
    page.on('console', msg => {
      console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
    });
    
    page.on('pageerror', error => {
      console.log(`[Browser Page Error] ${error.message}`);
    });
    
    // Wait for data to load
    await page.waitForTimeout(2000);
  });

  test('User can start a session, see transcript, and end it with summary', async ({ page }) => {
    // 1. First ensure we have at least one subordinate
    // Go to CRM page to check/add subordinate
    await page.goto('/crm');
    await expect(page).toHaveTitle(/Memento 1on1/);
    
    // Check if any subordinates exist in the table
    const subordinateRows = page.locator('.ant-table-row');
    const rowCount = await subordinateRows.count();
    
    if (rowCount === 0) {
      // Add a subordinate
      await page.getByRole('button', { name: 'Add Subordinate' }).click();
      await expect(page.getByText('Add New Subordinate')).toBeVisible();
      
      const uniqueName = `テスト部下${Date.now()}`;
      await page.getByRole('textbox', { name: 'Name' }).fill(uniqueName);
      
      // Select department
      await page.getByLabel('Department').click();
      await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
      await page.locator('.ant-select-item-option').filter({ hasText: 'Development' }).click();
      
      await page.getByRole('textbox', { name: 'Role' }).fill('テスト役職');
      await page.getByRole('button', { name: 'OK' }).click();
      
      await expect(page.getByText('Subordinate added successfully')).toBeVisible();
      await expect(page.getByText(uniqueName)).toBeVisible();
    }
    
    // 2. Go back to dashboard
    await page.goto('/');
    await expect(page).toHaveTitle(/Memento 1on1/);
    await expect(page.getByText('Start 1on1')).toBeVisible();

    // 3. Start Session Modal
    await page.getByText('Start 1on1').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Start New 1on1 Session')).toBeVisible();
    
    // Wait a moment for data to load
    await page.waitForTimeout(2000);

    // Fill form - simpler approach: use getByLabel for accessibility
    await page.getByLabel('Subordinate').click();
    
    // Wait for dropdown and select first option
    await page.waitForSelector('.ant-select-dropdown', { timeout: 10000 });
    await page.locator('.ant-select-item-option').first().waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('.ant-select-item-option').first().click();

    // Type Theme
    await page.getByLabel('Theme / Topic').fill('Playwright Test Theme');

    // Click OK (Start Session)
    await page.getByRole('button', { name: 'Start Session' }).click();

    // 3. Verify Session Page URL (UUID format)
    await expect(page).toHaveURL(/\/session\/[0-9a-f-]+/);
    await page.waitForLoadState('networkidle');
    
    // 4. Wait for session data to load
    // The page shows "Loading session data..." spinner while fetching
    await expect(page.getByText('Loading session data...')).toBeHidden({ timeout: 15000 });
    
    // Additional wait for data to be fully loaded
    await page.waitForTimeout(2000);
    
    // Check that session header is visible (indicates data loaded)
    await expect(page.getByText(/1on1 with/)).toBeVisible({ timeout: 10000 });
    
    // 5. Verify Real-time elements (Mock)
    // Wait for session page to load
    await expect(page.getByText('AI Copilot')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Playwright Test Theme')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Live Transcript')).toBeVisible({ timeout: 10000 });
    
    // Check Controls
    await expect(page.getByRole('button', { name: 'End Session' })).toBeVisible();

    // 5. Test Mind Map Switching
    await page.getByRole('button', { name: 'Switch to MindMap' }).click();
    // Wait for mode switch and ensure MindMap mode UI is visible
    await expect(page.getByRole('button', { name: 'Switch to Video' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Add Topic')).toBeVisible({ timeout: 10000 });
    
    // Add a manual node
    await page.getByText('Add Topic').click();
    await expect(page.getByText('New Topic')).toBeVisible({ timeout: 5000 });

    // Switch back
    await page.getByRole('button', { name: 'Switch to Video' }).click();

    // 6. End Session
    await page.getByRole('button', { name: 'End Session' }).click();

    // 7. Verify Summary Page
    await expect(page).toHaveURL(/\/session\/[0-9a-f-]+\/summary/);
    await expect(page.getByText('Session Completed Successfully')).toBeVisible();
    
    // Check for AI Summary
    await expect(page.getByText('AI Executive Summary')).toBeVisible();
    await expect(page.getByText('AIが会話を分析し、サマリーを生成しました。アクションアイテムを確認してください。')).toBeVisible();
    
    // Check for Transcript
    await expect(page.getByText('Full Transcript')).toBeVisible();
    await expect(page.getByText('Playwright Test Theme')).toBeVisible(); // Theme in details
  });

});
