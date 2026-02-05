import { test, expect } from '@playwright/test';
import { loginViaUI } from '../helpers/auth';
import { ensureSubordinate, createTestSession, cleanupTestSessions } from '../helpers/db';

test.describe.serial('Session History Navigation', () => {
  let testSessionId: string;
  let testSessionTheme: string;
  
  // Setup test data before all tests
  test.beforeAll(async () => {
    console.log('Setting up test session for history navigation...');
    try {
      // Clean up any existing test sessions first
      await cleanupTestSessions();
      
      // Ensure we have a subordinate
      const subordinate = await ensureSubordinate();
      
      // Create a unique theme to avoid conflicts with other test sessions
      testSessionTheme = `履歴ナビゲーションテスト-${Date.now()}`;
      
      // Create a completed test session
      const session = await createTestSession(subordinate.id!, {
        theme: testSessionTheme,
        status: 'completed',
        summary: 'これはテスト用のAIサマリーです。会話は良好で、次のアクションアイテムが確認されました。',
        transcript: [
          { speaker: 'manager', text: '今日の調子はどうですか？', timestamp: '2024-01-01T10:00:00Z' },
          { speaker: 'subordinate', text: '調子は良いです。現在のプロジェクトは順調です。', timestamp: '2024-01-01T10:01:00Z' },
          { speaker: 'manager', text: 'それは良かった。何か困っていることは？', timestamp: '2024-01-01T10:02:00Z' },
        ]
      });
      
      testSessionId = session.id!;
      console.log(`Test session created with ID: ${testSessionId}, theme: ${testSessionTheme}`);
    } catch (error) {
      console.error('Failed to setup test session:', error);
      throw error;
    }
  });
  
  // Cleanup after all tests
  test.afterAll(async () => {
    console.log('Cleaning up test sessions...');
    await cleanupTestSessions();
  });
  
  test.beforeEach(async ({ page }) => {
    // Log in with test user
    console.log('🔐 Logging in via UI...');
    await loginViaUI(page);
    
    // Capture console logs for debugging
    page.on('console', msg => {
      console.log(`[Browser Console ${msg.type().toUpperCase()}] ${msg.text()}`);
    });
    
    page.on('pageerror', error => {
      console.log(`[Browser Page Error] ${error.message}`);
    });
    
    // Capture network requests/responses for debugging
    page.on('request', req => {
      if (req.url().includes('sessions') || req.url().includes('supabase')) {
        console.log(`[Network Request] ${req.method()} ${req.url()}`);
      }
    });
    
    page.on('response', res => {
      if (res.url().includes('sessions') || res.url().includes('supabase')) {
        console.log(`[Network Response] ${res.status()} ${res.url()}`);
      }
    });
  });
  
  test('User can click on session table row to navigate to summary page', async ({ page }) => {
    console.log(`🚀 Starting test with session theme: ${testSessionTheme}`);
    console.log(`📝 Test session ID: ${testSessionId}`);
    
    // 1. Navigate to dashboard
    console.log('🌐 Navigating to dashboard...');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    console.log('✅ Dashboard loaded');
    
    // 2. Verify dashboard is loaded
    await expect(page).toHaveTitle(/Memento 1on1/);
    await expect(page.getByText('Recent Sessions')).toBeVisible();
    await expect(page.getByText('Start 1on1')).toBeVisible();
    console.log('✅ Dashboard UI verified');
    
    // 3. Wait for sessions table to load and find our specific session row
    console.log('📊 Waiting for sessions table to load...');
    
    // First ensure the table is loaded by checking for table headers
    await expect(page.getByText('Recent Sessions')).toBeVisible({ timeout: 10000 });
    console.log('✅ "Recent Sessions" header visible');
    
    // Wait for table rows to appear
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 10000 });
    
    // Get all table rows for debugging
    const allRows = page.locator('.ant-table-row');
    const rowCount = await allRows.count();
    console.log(`📈 Found ${rowCount} table rows`);
    
    // Log the content of first few rows for debugging
    for (let i = 0; i < Math.min(rowCount, 3); i++) {
      const rowText = await allRows.nth(i).textContent();
      console.log(`  Row ${i}: ${rowText?.substring(0, 100)}...`);
    }
    
    // Wait for our specific test session to appear in the table
    // Use retry logic to handle potential timing issues
    const maxAttempts = 10;
    let testSessionRow = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`🔄 Attempt ${attempt}/${maxAttempts} to find session row...`);
      
      // Refresh table rows count
      const currentRows = page.locator('.ant-table-row');
      const currentRowCount = await currentRows.count();
      console.log(`  Current table has ${currentRowCount} rows`);
      
      // Check each row for our test session theme
      for (let i = 0; i < currentRowCount; i++) {
        const rowText = await currentRows.nth(i).textContent();
        if (rowText && rowText.includes(testSessionTheme)) {

          testSessionRow = page.locator('.ant-table-row').filter({ hasText: testSessionTheme }).first();

          console.log(`🎯 Found test session at row ${i}: ${rowText?.substring(0, 100)}...`);
          break;
        }
      }
      
      if (testSessionRow) {
        try {
          await expect(testSessionRow).toBeVisible({ timeout: 2000 });
          console.log('✅ Test session row is visible');
          break; // Found it, break out of loop
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(`⚠️ Row found but not visible: ${errorMessage}`);
          testSessionRow = null;
        }
      }
      
      if (attempt === maxAttempts) {
        // Before failing, take a screenshot for debugging
        await page.screenshot({ path: `test-debug-${Date.now()}.png`, fullPage: true });
        console.log(`📸 Screenshot saved for debugging`);
        throw new Error(`Test session row not found after ${maxAttempts} attempts. Theme: ${testSessionTheme}. Found ${currentRowCount} rows total.`);
      }
      
      console.log(`⏳ Waiting 1 second before retry...`);
      await page.waitForTimeout(1000); // Wait 1 second before retry
    }
    
    if (!testSessionRow) {
      throw new Error('Failed to find test session row');
    }
    
    // 4. Verify row contents - there are two tags: mode and status, we want the status tag
    console.log('🔍 Verifying row contains COMPLETED tag...');
    await expect(testSessionRow.locator('.ant-tag').filter({ hasText: 'COMPLETED' })).toBeVisible();
    console.log('✅ Row has COMPLETED tag');
    
    // 5. Click on the table row
    console.log('🖱️ Clicking on session table row...');
    await testSessionRow.click();
    
    // 6. Verify navigation to summary page
    console.log('🧭 Waiting for navigation to summary page...');
    await expect(page).toHaveURL(/\/session\/[0-9a-f-]+\/summary/);
    await page.waitForLoadState('networkidle');
    console.log('✅ Navigated to summary page');
    
    // 7. Verify summary page loads correctly
    console.log('📄 Verifying summary page loads...');
    await expect(page.getByText('セッション要約')).toBeVisible({ timeout: 10000 });
    console.log('✅ "セッション要約" header visible');
    await expect(page.getByText('Session Completed Successfully')).toBeVisible();
    console.log('✅ Success message visible');
    await expect(page.getByText('履歴ナビゲーションテスト')).toBeVisible();
    console.log('✅ Session theme visible');
    
    // 8. Verify AI summary is displayed
    console.log('🤖 Verifying AI summary...');
    await expect(page.getByText('AI Executive Summary')).toBeVisible();
    console.log('✅ AI Executive Summary visible');
    await expect(page.getByText('これはテスト用のAIサマリーです')).toBeVisible();
    console.log('✅ AI summary content visible');
    
    // 9. Verify transcript is displayed
    console.log('📝 Verifying transcript...');
    await expect(page.getByText('Full Transcript')).toBeVisible();
    console.log('✅ Full Transcript section visible');
    await expect(page.getByText('今日の調子はどうですか？')).toBeVisible();
    console.log('✅ Transcript content visible (manager)');
    await expect(page.getByText('調子は良いです')).toBeVisible();
    console.log('✅ Transcript content visible (subordinate)');
    
    // 10. Verify back to dashboard button works
    console.log('🔙 Testing back to dashboard button...');
    await page.getByText('ダッシュボードに戻る').first().click();
    await expect(page).toHaveURL('/');
    console.log('✅ Returned to dashboard');
    
    console.log('🎉 Test completed successfully!');
  });
  
  test('Table row has proper hover styles and accessibility attributes', async ({ page }) => {
    console.log(`🚀 Starting accessibility test with session theme: ${testSessionTheme}`);
    
    // Navigate to dashboard
    console.log('🌐 Navigating to dashboard...');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    console.log('✅ Dashboard loaded');
    
    // Wait for sessions table to load and find our specific session row
    console.log('📊 Waiting for sessions table to load...');
    
    // First ensure the table is loaded by checking for table headers
    await expect(page.getByText('Recent Sessions')).toBeVisible({ timeout: 10000 });
    console.log('✅ "Recent Sessions" header visible');
    
    // Wait for table rows to appear
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 10000 });
    
    // Get all table rows for debugging
    const allRows = page.locator('.ant-table-row');
    const rowCount = await allRows.count();
    console.log(`📈 Found ${rowCount} table rows`);
    
    // Wait for our specific test session to appear in the table
    // Use retry logic to handle potential timing issues
    const maxAttempts = 10;
    let testSessionRow = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`🔄 Attempt ${attempt}/${maxAttempts} to find session row...`);
      
      // Refresh table rows count
      const currentRows = page.locator('.ant-table-row');
      const currentRowCount = await currentRows.count();
      console.log(`  Current table has ${currentRowCount} rows`);
      
      // Check each row for our test session theme
      for (let i = 0; i < currentRowCount; i++) {
        const rowText = await currentRows.nth(i).textContent();
        if (rowText && rowText.includes(testSessionTheme)) {

          testSessionRow = page.locator('.ant-table-row').filter({ hasText: testSessionTheme }).first();

          console.log(`🎯 Found test session at row ${i}: ${rowText?.substring(0, 100)}...`);
          break;
        }
      }
      
      if (testSessionRow) {
        try {
          await expect(testSessionRow).toBeVisible({ timeout: 2000 });
          console.log('✅ Test session row is visible');
          break; // Found it, break out of loop
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(`⚠️ Row found but not visible: ${errorMessage}`);
          testSessionRow = null;
        }
      }
      
      if (attempt === maxAttempts) {
        // Before failing, take a screenshot for debugging
        await page.screenshot({ path: `test-debug-accessibility-${Date.now()}.png`, fullPage: true });
        console.log(`📸 Screenshot saved for debugging`);
        throw new Error(`Test session row not found after ${maxAttempts} attempts. Theme: ${testSessionTheme}. Found ${currentRowCount} rows total.`);
      }
      
      console.log(`⏳ Waiting 1 second before retry...`);
      await page.waitForTimeout(1000); // Wait 1 second before retry
    }
    
    if (!testSessionRow) {
      throw new Error('Failed to find test session row');
    }
    
    // 1. Verify row has cursor: pointer style
    const rowStyle = await testSessionRow.getAttribute('style');
    expect(rowStyle).toContain('cursor: pointer');
    
    // 2. Verify row has role="button"
    await expect(testSessionRow).toHaveAttribute('role', 'button');
    
    // 3. Verify row has tabindex="0"
    await expect(testSessionRow).toHaveAttribute('tabindex', '0');
    
    // 4. Verify row has aria-label
    const ariaLabel = await testSessionRow.getAttribute('aria-label');
    expect(ariaLabel).toContain('View details for session with theme:');
    
    // 5. Verify hover effect (check for hover class)
    await testSessionRow.hover();
    await page.waitForTimeout(500); // Allow hover state to apply
    
    // Check if background color changes on hover
    const hoverColor = await testSessionRow.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    
    // The actual color depends on theme, but should not be transparent
    expect(hoverColor).not.toBe('rgba(0, 0, 0, 0)');
  });
  
  test('Session summary page shows appropriate message for different session statuses', async ({ page }) => {
    // Create additional test sessions with different statuses
    const subordinate = await ensureSubordinate();
    
    // Create a live session
    const liveSession = await createTestSession(subordinate.id!, {
      theme: 'ライブセッションテスト',
      status: 'live',
      summary: undefined, // No summary yet for live session
      transcript: [],
    });
    
    // Create a scheduled session
    const scheduledSession = await createTestSession(subordinate.id!, {
      theme: '予定セッションテスト',
      status: 'scheduled',
      date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      summary: undefined,
      transcript: [],
    });
    
    try {
      // Test completed session (already in beforeAll)
      await page.goto(`/session/${testSessionId}/summary`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText('Session Completed Successfully')).toBeVisible();
      await expect(page.getByText('セッションが正常に完了しました')).toBeVisible();
      
      // Test live session
      await page.goto(`/session/${liveSession.id}/summary`);
      await page.waitForLoadState('networkidle');
      
      // Find the status card for live session (has specific background color rgb(230, 247, 255))
      const liveSessionCard = page.locator('.ant-card[style*="rgb(230, 247, 255)"]');
      await expect(liveSessionCard).toBeVisible();
      await expect(liveSessionCard).toContainText('リアルタイムの要約とトランスクリプトが表示されます');
      
      // Test scheduled session
      await page.goto(`/session/${scheduledSession.id}/summary`);
      await page.waitForLoadState('networkidle');
      
      // Find the status card for scheduled session (has specific background color rgb(255, 247, 230))
      const scheduledSessionCard = page.locator('.ant-card[style*="rgb(255, 247, 230)"]');
      await expect(scheduledSessionCard).toBeVisible();
      await expect(scheduledSessionCard).toContainText('セッションはまだ開始されていません');
      
    } finally {
      // Cleanup the additional test sessions
      // Note: cleanupTestSessions in afterAll will clean these too
    }
  });
});