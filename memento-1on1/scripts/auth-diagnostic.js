#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * 認証診断スクリプト
 * 使用方法: cd /home/monetta/src/memento-1on1/memento-app && node scripts/auth-diagnostic.js
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

async function runDiagnostics() {
  console.log('🔍 Memento 1on1 認証診断スクリプト');
  console.log('=' * 60);
  
  // 1. 環境変数のチェック
  console.log('\n1. 環境変数チェック:');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  
  const envVars = [
    { name: 'NEXT_PUBLIC_SUPABASE_URL', value: supabaseUrl, required: true },
    { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: supabaseAnonKey ? '設定済み（マスク済み）' : '未設定', required: true },
    { name: 'NEXT_PUBLIC_SITE_URL', value: siteUrl, required: true },
  ];
  
  let allEnvVarsValid = true;
  for (const env of envVars) {
    const isValid = env.value && env.value !== '未設定';
    const status = isValid ? '✅' : '❌';
    console.log(`   ${status} ${env.name}: ${env.value || '未設定'}`);
    if (!isValid && env.required) allEnvVarsValid = false;
  }
  
  if (!allEnvVarsValid) {
    console.log('\n❌ 必須環境変数が設定されていません。');
    return;
  }
  
  // 2. Supabaseクライアントの初期化
  console.log('\n2. Supabaseクライアント初期化:');
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log('   ✅ Supabaseクライアントを初期化しました');
    
    // 3. 現在のセッションを確認
    console.log('\n3. 現在のセッション確認:');
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log(`   ❌ セッション取得エラー: ${error.message}`);
    } else if (session) {
      console.log(`   ✅ セッションが見つかりました:`);
      console.log(`      - ユーザー: ${session.user.email}`);
      console.log(`      - 有効期限: ${new Date(session.expires_at * 1000).toLocaleString()}`);
      console.log(`      - プロバイダートークン: ${session.provider_token ? 'あり' : 'なし'}`);
      console.log(`      - リフレッシュトークン: ${session.refresh_token ? 'あり' : 'なし'}`);
    } else {
      console.log('   ℹ️ アクティブなセッションはありません');
    }
    
    // 4. Supabase設定の確認（API経由）
    console.log('\n4. Supabaseプロジェクト設定確認:');
    try {
      // プロジェクトのメタデータを取得
      const projectResponse = await fetch(`${supabaseUrl}/auth/v1/settings`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      });
      
      if (projectResponse.ok) {
        const settings = await projectResponse.json();
        console.log('   ✅ Supabaseプロジェクトに接続できました');
        console.log(`      - 外部URL: ${settings.external_url}`);
        console.log(`      - JWT有効期限: ${settings.jwt_expiry || 'N/A'}秒`);
      } else {
        console.log(`   ❌ プロジェクト設定取得失敗: ${projectResponse.status}`);
      }
    } catch (fetchError) {
      console.log(`   ❌ プロジェクト設定取得エラー: ${fetchError.message}`);
    }
    
    // 5. OAuth設定の推論
    console.log('\n5. OAuth設定の推論:');
    console.log(`   ℹ️ Supabaseダッシュボードで確認が必要な項目:`);
    console.log(`      - Authentication → Settings → Site URL: ${siteUrl}`);
    console.log(`      - Authentication → Providers → Google:`);
    console.log(`        * Client ID: Google Cloud Consoleから設定`);
    console.log(`        * Client Secret: Google Cloud Consoleから設定`);
    console.log(`        * Enabled: ON`);
    console.log(`        * Callback URL: ${supabaseUrl}/auth/v1/callback`);
    
    // 6. Google Cloud Console設定の推論
    console.log('\n6. Google Cloud Console設定確認:');
    console.log(`   ℹ️ Google Cloud Consoleで確認が必要な項目:`);
    console.log(`      - OAuth同意画面:`);
    console.log(`        * 公開ステータス: テスト中`);
    console.log(`        * テストユーザー: 自分のメールアドレスが追加されている`);
    console.log(`        * スコープ: email, profile, https://www.googleapis.com/auth/calendar, openid`);
    console.log(`      - 認証情報:`);
    console.log(`        * OAuth 2.0 クライアントIDが作成されている`);
    console.log(`        * 承認済みリダイレクトURI: ${supabaseUrl}/auth/v1/callback`);
    
    // 7. 推奨アクション
    console.log('\n7. 推奨アクション:');
    if (!session) {
      console.log(`   🔧 セッションがない場合のトラブルシューティング:`);
      console.log(`      1. ブラウザで ${siteUrl}/login にアクセス`);
      console.log(`      2. 「Googleでログイン」をクリック`);
      console.log(`      3. Google認証画面で許可`);
      console.log(`      4. リダイレクト後にこのスクリプトを再実行`);
    } else {
      console.log(`   ✅ セッションは有効です。問題は別の場所にある可能性があります。`);
      console.log(`      - middleware.tsの設定を確認`);
      console.log(`      - AuthProviderの状態管理を確認`);
      console.log(`      - ブラウザのCookie設定を確認`);
    }
    
    // 8. クイックチェック用コマンド
    console.log('\n8. クイックチェックコマンド:');
    console.log(`   curl -s -o /dev/null -w "%{http_code}" ${siteUrl}/login`);
    console.log(`   # 200が返ることを確認`);
    console.log(`   curl -s -o /dev/null -w "%{http_code}" ${siteUrl}/`);
    console.log(`   # ログインしていない場合はリダイレクト(307)されるはず`);
    
  } catch (error) {
    console.log(`   ❌ Supabaseクライアント初期化エラー: ${error.message}`);
  }
  
  console.log('\n' + '=' * 60);
  console.log('診断完了。問題があれば上記の推奨アクションを試してください。');
}

// 実行
runDiagnostics().catch(error => {
  console.error('診断スクリプト実行エラー:', error);
  process.exit(1);
});