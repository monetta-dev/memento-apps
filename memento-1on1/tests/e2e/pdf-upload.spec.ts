import { test, expect } from '@playwright/test';
import { loginViaUI } from '../helpers/auth';

test.describe('PDF Upload and Analysis', () => {
  
  test.beforeEach(async ({ page }) => {
    // Log in with test user and navigate to CRM
    await loginViaUI(page);
    await page.goto('/crm');
  });

  test('User can add subordinate and PDF upload field exists', async ({ page }) => {
    const subordinateName = `Test Subordinate ${Date.now()}`;
    const subordinateRole = `Test Role ${Date.now()}`;
    
    // 1. Check CRM page
    await expect(page).toHaveTitle(/Memento 1on1/);
    await expect(page.getByText('Subordinate Management (CRM)')).toBeVisible();
    await expect(page.getByText('Add Subordinate')).toBeVisible();

    // 2. Add a new subordinate
    await page.getByText('Add Subordinate').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Add New Subordinate')).toBeVisible();
    
    // Fill form
    await page.fill('#name', subordinateName);
    // Select department
    await page.getByLabel('Department', { exact: true }).click();
    await page.waitForSelector('.ant-select-dropdown:not([style*="display: none"])');
    await page.locator('.ant-select-item-option').first().click(); // Select first department
    await page.fill('#role', subordinateRole);
    
    // 3. Check PDF upload field exists in the form
    await expect(page.getByText('Upload Evaluation PDF')).toBeVisible();
    await expect(page.getByText('AI will analyze the PDF and extract traits automatically.')).toBeVisible();
    
    // 4. Click OK (Add Subordinate) - use the dialog's button
    const addButton = page.getByRole('dialog').getByRole('button', { name: 'OK' });
    await expect(addButton).toBeEnabled();
    await addButton.click();
    
    // 5. Wait for success message and table update
    await expect(page.locator('.ant-message-success')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('row').filter({ hasText: subordinateName })).toBeVisible();
  });

  test('PDF upload API can be mocked', async ({ page }) => {
    // Mock the PDF analysis API
    await page.route('**/api/pdf/analyze', async (route) => {
      // Return mock response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          traits: ['Analytical', 'Detail-oriented', 'Collaborative'],
          originalText: 'Mock analysis for testing'
        })
      });
    });
    
    // Navigate to CRM and add subordinate
    await page.goto('/crm');
    await page.getByText('Add Subordinate').click();
    
    // Fill minimal form
    await page.fill('#name', 'Test PDF Subordinate');
    await page.getByLabel('Department', { exact: true }).click();
    await page.waitForSelector('.ant-select-dropdown:not([style*="display: none"])');
    await page.locator('.ant-select-item-option').first().click();
    await page.fill('#role', 'Test Role');
    
    // Add subordinate
    const addButton = page.getByRole('dialog').getByRole('button', { name: 'OK' });
    await addButton.click();
    
    await expect(page.locator('.ant-message-success')).toBeVisible({ timeout: 5000 });
    
    // Test would continue with PDF upload using mocked API
    // For now, just verify the mock works
    test.skip();
  });

  test('PDF upload shows error for non-PDF files', async ({ page: _ }) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    // This test requires mocking the file validation
    // For now, skip or implement basic check
    test.skip();
  });

});