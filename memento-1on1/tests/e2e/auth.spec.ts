import { test, expect } from '@playwright/test';

test.describe('認証フロー', () => {
  
  test('未認証ユーザーはログインページにリダイレクトされる', async ({ page }) => {
    // 保護されたルートにアクセス
    await page.goto('/');
    
    // ログインページにリダイレクトされることを確認
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Memento 1on1' })).toBeVisible();
    await expect(page.getByText('1on1をより効果的に、継続的に')).toBeVisible();
  });

  test('ログインページが正しく表示される', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    
    // ページタイトルと要素を確認
    await expect(page).toHaveTitle(/Memento 1on1/);
    await expect(page.getByRole('heading', { name: 'Memento 1on1' })).toBeVisible();
    await expect(page.getByText('1on1をより効果的に、継続的に')).toBeVisible();
    
    // フォーム要素を確認（プレースホルダーを使用）
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ログイン', exact: true })).toBeVisible();
    
    // Googleログインボタンを確認
    await expect(page.getByText('Googleでログイン')).toBeVisible();
    
    // 新規登録リンクを確認
    await expect(page.getByText('アカウントをお持ちでないですか？')).toBeVisible();
    await expect(page.getByText('新規登録')).toBeVisible();
  });

  test('サインアップページが正しく表示される', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('domcontentloaded');
    
    // ページタイトルと要素を確認
    await expect(page).toHaveTitle(/Memento 1on1/);
    await expect(page.getByText('新規登録')).toBeVisible();
    await expect(page.getByText('Memento 1on1を始めましょう')).toBeVisible();
    
    // フォーム要素を確認（プレースホルダーを使用）
    await expect(page.getByPlaceholder('山田 太郎')).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••').first()).toBeVisible();
    await expect(page.getByPlaceholder('••••••••').nth(1)).toBeVisible(); // 確認用パスワード
    await expect(page.getByRole('button', { name: '登録する' })).toBeVisible();
    
    // Google登録ボタンを確認
    await expect(page.getByText('Googleで登録')).toBeVisible();
    
    // ログインリンクを確認
    await expect(page.getByText('既にアカウントをお持ちですか？')).toBeVisible();
    await expect(page.getByText('ログイン')).toBeVisible();
  });

  test('メール/パスワードログインのバリデーションが機能する', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    
    // 空のフォームで送信を試みる
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    
    // バリデーションエラーが表示されることを確認
    await expect(page.getByText('メールアドレスを入力してください')).toBeVisible();
    
    // 無効なメールアドレスを入力
    await page.getByPlaceholder('you@example.com').fill('invalid-email');
    await page.getByPlaceholder('••••••••').fill('test');
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    
    // メール形式のエラーが表示されることを確認
    await expect(page.getByText('有効なメールアドレスを入力してください')).toBeVisible();
  });

  test('サインアップのバリデーションが機能する', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('networkidle');
    
    // パスワード不一致をテスト
    await page.getByLabel('氏名', { exact: true }).fill('テストユーザー');
    await page.getByLabel('メールアドレス', { exact: true }).fill('test@example.com');
    await page.getByLabel('パスワード', { exact: true }).fill('password123');
    await page.getByLabel('パスワード（確認）', { exact: true }).fill('differentpassword');
    await page.getByRole('button', { name: '登録する' }).click();
    
    // パスワード不一致エラーが表示されることを確認
    await expect(page.getByText('パスワードが一致しません')).toBeVisible();
  });

  test('ログインとサインアップページ間をナビゲートできる', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // ログインページからサインアップページへ
    await page.getByText('新規登録').click();
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.getByText('新規登録')).toBeVisible();
    
    // サインアップページからログインページへ
    await page.getByText('ログイン').click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Memento 1on1' })).toBeVisible();
  });

  // 注: Google OAuthのテストは実際の認証が必要なため、コメントアウト
  // test('Googleログインボタンがクリックできる', async ({ page }) => {
  //   await page.goto('/login');
  //   
  //   // Googleボタンをクリック
  //   const [popup] = await Promise.all([
  //     page.waitForEvent('popup'),
  //     page.getByText('Googleでログイン').click()
  //   ]);
  //   
  //   // ポップアップが開くことを確認
  //   await expect(popup).toHaveURL(/accounts\.google\.com/);
  // });

  // 注: 実際の認証テストは環境変数やテストユーザーが必要なため、別のテストファイルで実装
  // このテストはUIの基本的な機能のみを確認

  test('テストユーザーでログインできる', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // テストユーザーの資格情報を入力
    await page.getByPlaceholder('you@example.com').fill(process.env.TEST_USER_EMAIL || 'test@memento-1on1.com');
    await page.getByPlaceholder('••••••••').fill(process.env.TEST_USER_PASSWORD || 'TestPassword123!');
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();

    // ダッシュボードにリダイレクトされることを確認
    await page.waitForURL('/');
    await expect(page.getByText('Start 1on1')).toBeVisible({ timeout: 10000 });

    // ログアウトはドロップダウンメニュー内にあるため、このテストではスキップ
    // 実際のテストではドロップダウン操作が必要
  });
});