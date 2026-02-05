'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@/lib/supabase';
import { Card, Button, Typography, List, Alert, Steps } from 'antd';

const { Title, Text } = Typography;

export default function AuthTestPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [testResults, setTestResults] = useState<Record<string, any>>({}); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [loading, setLoading] = useState(false);
  
  const supabase = createClientComponentClient();

  const runTest = async (testName: string, testFunc: () => Promise<any>) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    setLoading(true);
    try {
      console.log(`🔍 ${testName} 開始`);
      const result = await testFunc();
      console.log(`✅ ${testName} 成功:`, result);
      
      setTestResults(prev => ({
        ...prev,
        [testName]: { success: true, data: result, timestamp: new Date().toISOString() }
      }));
      
      return true;
     } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      console.error(`❌ ${testName} 失敗:`, error);
      
      setTestResults(prev => ({
        ...prev,
        [testName]: { success: false, error: error.message, timestamp: new Date().toISOString() }
      }));
      
      return false;
    } finally {
      setLoading(false);
    }
  };

  const test1_envVars = async () => {
    const missing = [];
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    if (!process.env.NEXT_PUBLIC_SITE_URL) missing.push('NEXT_PUBLIC_SITE_URL');
    
    return {
      hasAllVars: missing.length === 0,
      missing,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? '設定済み' : '未設定'
    };
  };

  const test2_supabaseClient = async () => {
    if (!supabase) {
      throw new Error('Supabaseクライアントが初期化されていません');
    }
    return { clientInitialized: true };
  };

  const test3_currentSession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      throw new Error(`セッション取得エラー: ${error.message}`);
    }
    
    return {
      hasSession: !!session,
      userEmail: session?.user?.email,
      expiresAt: session?.expires_at ? new Date(session.expires_at).toLocaleString() : null
    };
  };

  const test4_googleOAuthUrl = async () => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const redirectUrl = `${siteUrl}/api/auth/callback`;
    
    return {
      siteUrl,
      redirectUrl,
      expectedPattern: `${siteUrl}/api/auth/callback`
    };
  };

  const runAllTests = async () => {
    setCurrentStep(0);
    
    const tests = [
      { name: '環境変数チェック', func: test1_envVars },
      { name: 'Supabaseクライアントチェック', func: test2_supabaseClient },
      { name: '現在のセッションチェック', func: test3_currentSession },
      { name: 'OAuth URLチェック', func: test4_googleOAuthUrl },
    ];
    
    for (let i = 0; i < tests.length; i++) {
      setCurrentStep(i);
      const success = await runTest(tests[i].name, tests[i].func);
      if (!success) break;
      
      // 少し待つ
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (currentStep >= tests.length - 1) {
      setCurrentStep(tests.length);
    }
  };

  const getStepStatus = (stepIndex: number) => {
    if (stepIndex < currentStep) return 'finish';
    if (stepIndex === currentStep) return 'process';
    return 'wait';
  };

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <Title level={2}>🔧 認証テスト</Title>
      
       <Card style={{ marginBottom: 20 }}>
        <Steps 
          current={currentStep}
          items={[
            { title: '環境変数', description: '設定確認', status: getStepStatus(0) },
            { title: 'Supabaseクライアント', description: '接続確認', status: getStepStatus(1) },
            { title: 'セッション', description: '現在の状態', status: getStepStatus(2) },
            { title: 'OAuth URL', description: '設定確認', status: getStepStatus(3) },
            { title: '完了', description: 'テスト終了', status: getStepStatus(4) },
          ]}
        />
      </Card>

      <div style={{ marginBottom: 20 }}>
        <Button 
          type="primary" 
          onClick={runAllTests}
          loading={loading}
          style={{ marginRight: 10 }}
        >
          すべてのテストを実行
        </Button>
        
        <Button 
          onClick={() => {
            setTestResults({});
            setCurrentStep(0);
          }}
        >
          リセット
        </Button>
      </div>

      {Object.keys(testResults).length > 0 && (
        <Card title="テスト結果" style={{ marginBottom: 20 }}>
          <List
            dataSource={Object.entries(testResults)}
            renderItem={([testName, result]) => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    result.success ? (
                      <span style={{ color: 'green', fontSize: '18px' }}>✅</span>
                    ) : (
                      <span style={{ color: 'red', fontSize: '18px' }}>❌</span>
                    )
                  }
                  title={testName}
                  description={
                    <div>
                      <Text type={result.success ? 'success' : 'danger'}>
                        {result.success ? '成功' : `失敗: ${result.error}`}
                      </Text>
                      <br />
                      <Text type="secondary">
                        時間: {new Date(result.timestamp).toLocaleTimeString()}
                      </Text>
                      {result.data && (
                        <pre style={{ 
                          background: '#f5f5f5', 
                          padding: 10, 
                          borderRadius: 4, 
                          marginTop: 8,
                          fontSize: '12px',
                          maxHeight: '200px',
                          overflow: 'auto'
                        }}>
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      <Card title="次のステップ">
        <List
          dataSource={[
            {
              title: '1. テストを実行',
              description: '上記の「すべてのテストを実行」ボタンをクリック',
              status: Object.keys(testResults).length > 0 ? '✅' : '⏳'
            },
            {
              title: '2. 環境変数を確認',
              description: 'すべての環境変数が設定されているか確認',
              status: testResults['環境変数チェック']?.success ? '✅' : '⚠️'
            },
            {
              title: '3. ログインページでテスト',
              description: '別タブでログインページを開き、Googleログインを試す',
              status: '🔗'
            },
            {
              title: '4. デバッグページで確認',
              description: 'ログイン後にデバッグページでセッションを確認',
              status: '🔗'
            },
          ]}
          renderItem={(item, index) => (
            <List.Item>
              <List.Item.Meta
                avatar={<span style={{ fontSize: '20px' }}>{item.status}</span>}
                title={item.title}
                description={item.description}
              />
              {index === 2 && (
                <Button type="link" onClick={() => window.open('/login', '_blank')}>
                  ログインページを開く
                </Button>
              )}
              {index === 3 && (
                <Button type="link" onClick={() => window.open('/debug/auth', '_blank')}>
                  デバッグページを開く
                </Button>
              )}
            </List.Item>
          )}
        />
      </Card>

      <Alert
        message="トラブルシューティング"
        description={
          <ul>
            <li>環境変数が設定されていない場合は、.env.localファイルを確認</li>
            <li>Supabase URLが正しいか確認（ダッシュボードからコピー）</li>
            <li>Google OAuthがSupabaseで有効になっているか確認</li>
            <li>テストユーザーに自分のメールが追加されているか確認</li>
            <li>ブラウザのコンソールでエラーメッセージを確認</li>
          </ul>
        }
        type="info"
        style={{ marginTop: 20 }}
      />
    </div>
  );
}