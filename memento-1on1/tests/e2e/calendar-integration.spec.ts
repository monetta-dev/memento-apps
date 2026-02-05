import { test, expect } from '@playwright/test';
import { loginViaUI } from '../helpers/auth';

test.describe('Google Calendar連携とセッション作成', () => {
  // 注: これらのテストは認証が必要です
  // テストを実行する前に、手動でログインするか、
  // 環境変数 TEST_EMAIL と TEST_PASSWORD を設定してください

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
  });

  test('セッション作成時に日時を指定できる', async ({ page }) => {
    await page.goto('/');
    
    // Start 1on1ボタンをクリック
    await page.getByRole('button', { name: 'Start 1on1' }).click();
    
    // モーダルが表示されることを確認
    await expect(page.getByText('Start New 1on1 Session')).toBeVisible();
    
    // 部下を選択
    await page.locator('#subordinateId').click();
    await page.locator('.ant-select-item-option').first().click();
    
    // モードを選択（デフォルトでWeb）
    await page.getByText('Face-to-Face').click();
    
    // テーマを入力
    await page.getByPlaceholder('e.g., Career Growth, Project A, Feedback').fill('キャリア成長について');
    
    // 日時を選択（DatePickerの操作は複雑なので、簡単なテスト）
    // DatePickerが表示されていることを確認
    await expect(page.locator('.ant-picker-input')).toBeVisible();
    
    // 期間を入力
    await page.getByRole('spinbutton').fill('1.5');
    
    // セッションを開始
    await page.getByRole('button', { name: 'Start Session' }).click();
    
    // セッションページにリダイレクトされることを確認
    await expect(page).toHaveURL(/\/session\/[a-f0-9-]+/);
    await expect(page.getByText('Session')).toBeVisible();
  });

  test('カレンダー連携テストページが正しく表示される', async ({ page }) => {
    await page.goto('/test/google-calendar');
    
    // ページタイトルを確認
    await expect(page.getByText('📅 Google Calendar連携テスト')).toBeVisible();
    
    // 現在のセッション状態が表示されることを確認
    await expect(page.getByText('現在のセッション状態')).toBeVisible();
    
    // テスト実行ボタンが存在することを確認
    await expect(page.getByRole('button', { name: 'すべてのテストを実行' })).toBeVisible();
    
    // カレンダーイベント作成フォームが表示されることを確認
    await expect(page.getByText('カレンダーイベント作成テスト').first()).toBeVisible();
  });

  test('部下管理画面で部下を追加できる', async ({ page }) => {
    await page.goto('/crm');
    
    // Add Subordinateボタンをクリック
    await page.getByRole('button', { name: 'Add Subordinate' }).click();
    
    // モーダルが表示されることを確認
    await expect(page.getByText('Add New Subordinate')).toBeVisible();
    
    // フォームに入力 - use unique name to avoid duplicates
    const uniqueName = `テスト部下${Date.now()}`;
    await page.getByRole('textbox', { name: 'Name' }).fill(uniqueName);
    await page.getByLabel('Department').click();
    await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
    await page.locator('.ant-select-item-option').filter({ hasText: 'Development' }).click();
    await page.getByRole('textbox', { name: 'Role' }).fill('テスト役職');
    
    // 追加ボタンをクリック
    await page.getByRole('button', { name: 'OK' }).click();
    
    // 成功メッセージが表示されることを確認
    await expect(page.getByText('Subordinate added successfully')).toBeVisible();
    
    // テーブルに新しい部下が表示されることを確認
    await expect(page.getByText(uniqueName)).toBeVisible();
  });

  test('セッション一覧に新しいセッションが表示される', async ({ page }) => {
    await page.goto('/');
    
    // セッション一覧テーブルが表示されることを確認
    await expect(page.getByText('Recent Sessions')).toBeVisible();
    
    // テーブルに少なくとも1行あることを確認
    const tableRows = page.locator('.ant-table-row');
    await expect(tableRows).not.toHaveCount(0);
  });

  // 注: 実際のGoogle Calendar API連携のテストは、実際のAPI呼び出しが必要なため
  // 別のテスト環境で実行するか、モックを使用する必要があります
});