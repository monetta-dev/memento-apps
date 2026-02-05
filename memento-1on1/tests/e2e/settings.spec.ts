import { test, expect } from '@playwright/test';
import { loginViaUI } from '../helpers/auth';

test.describe('Settings Page Integrations', () => {
  
  test.beforeEach(async ({ page }) => {
    // Log in with test user and navigate to settings
    await loginViaUI(page);
    await page.goto('/settings');
  });

  test('Settings page loads with integration cards', async ({ page }) => {
    // 1. Check page title
    await expect(page).toHaveTitle(/Memento 1on1/);
    await expect(page.getByRole('heading', { name: '設定', level: 2 })).toBeVisible();
    
    // 2. Check Integrations card (exact match for card title)
    await expect(page.getByText('Integrations', { exact: true })).toBeVisible();
    
    // 3. Check for Google Calendar integration
    await expect(page.getByRole('heading', { name: 'Googleカレンダー連携', level: 4 })).toBeVisible();
    await expect(page.getByText('Googleカレンダー連携を使用するには、Googleアカウントでログインしてください。').first()).toBeVisible();
    
    // 4. Check for LINE integration  
    await expect(page.getByRole('heading', { name: 'LINE連携', level: 4 })).toBeVisible();
    await expect(page.getByText('リマインダーや通知をLINEで送信します。')).toBeVisible();
    
    // 5. Check for toggle switches
    const googleSwitch = page.getByRole('switch').first();
    await expect(googleSwitch).toBeVisible();
    
    const lineSwitch = page.getByRole('switch').nth(1);
    await expect(lineSwitch).toBeVisible();
    
    // 6. Check for connect buttons
    await expect(page.getByRole('button', { name: '接続' })).toHaveCount(2);
  });

  test('User can toggle integration switches', async ({ page }) => {
    // 1. Get toggle switches
    const switches = page.getByRole('switch');
    const firstSwitch = switches.first();
    const secondSwitch = switches.nth(1);
    
    // First switch (Google Calendar) should be disabled for non-Google auth users
    await expect(firstSwitch).toBeDisabled();
    await expect(firstSwitch).not.toBeChecked();
    
    // 2. Test second switch (LINE) - should be enabled
    await expect(secondSwitch).not.toBeChecked();
    await expect(secondSwitch).toBeEnabled();
    
    // Toggle LINE switch on
    await secondSwitch.click();
    await expect(secondSwitch).toBeChecked({ timeout: 5000 });
    
    // Toggle off
    await secondSwitch.click();
    await expect(secondSwitch).not.toBeChecked({ timeout: 5000 });
  });

  test('Configure buttons are clickable', async ({ page }) => {
    // Connect buttons should open alert dialogs
    // We'll just verify they're clickable
    
    const connectButtons = page.getByRole('button', { name: '接続' });
    await expect(connectButtons).toHaveCount(2);
    
    // First button (Google) is disabled for non-Google auth users
    await expect(connectButtons.first()).toBeDisabled();
    
    // Second button (LINE) should be enabled and clickable
    const lineConnectButton = connectButtons.nth(1);
    await expect(lineConnectButton).toBeEnabled();
    await lineConnectButton.click();
    
    // Should show alert dialog (can't test alert content easily)
    // At least verify button is clickable
  });

});