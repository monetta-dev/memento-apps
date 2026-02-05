'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@/lib/supabase';
import { Card, Button, Typography, Alert, Steps, Spin } from 'antd';

const { Title, Text } = Typography;

export default function ClearSessionPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [sessionInfo, setSessionInfo] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [loading, setLoading] = useState(true);
  
  const supabase = createClientComponentClient();

  useEffect(() => {
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkSession = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    setSessionInfo({
      hasSession: !!session,
      email: session?.user?.email,
      id: session?.user?.id
    });
    setLoading(false);
  };

  const clearSession = async () => {
    setCurrentStep(1);
    setLoading(true);
    
    try {
      // すべてのSupabase関連のCookieを削除
      document.cookie.split(';').forEach(cookie => {
        const name = cookie.split('=')[0].trim();
        if (name.includes('sb-') || name.includes('supabase')) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        }
      });
      
      // Supabaseからログアウト
      await supabase.auth.signOut();
      
      // 少し待つ
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setCurrentStep(2);
      await checkSession();
      
    } catch (error) {
      console.error('セッションクリアエラー:', error);
      setCurrentStep(3);
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    router.push('/login');
  };

  if (loading && currentStep === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <Spin size="large" />
        <Text>セッション情報を確認中...</Text>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
      <Title level={2}>🔧 セッション管理</Title>
      
       <Card style={{ marginBottom: 20 }}>
        <Steps 
          current={currentStep}
          items={[
            { title: '現在の状態', description: 'セッション確認' },
            { title: 'クリア中', description: 'セッション削除' },
            { title: '完了', description: 'ログインページへ' },
            { title: 'エラー', description: '処理失敗' },
          ]}
        />
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <Title level={4}>現在のセッション状態</Title>
        
        {sessionInfo?.hasSession ? (
          <Alert
            message="ログイン済み"
            description={
              <div>
                <p>メールアドレス: {sessionInfo.email}</p>
                <p>ユーザーID: {sessionInfo.id}</p>
                <p>このセッションをクリアして、Google OAuthのテストを実施できます。</p>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />
        ) : (
          <Alert
            message="未ログイン"
            description="現在アクティブなセッションはありません。"
            type="success"
            showIcon
            style={{ marginBottom: 20 }}
          />
        )}
      </Card>

      {currentStep === 0 && (
        <div style={{ textAlign: 'center' }}>
          {sessionInfo?.hasSession ? (
            <>
              <Button 
                type="primary" 
                danger 
                onClick={clearSession}
                loading={loading}
                style={{ marginRight: 10 }}
              >
                セッションをクリアしてログアウト
              </Button>
              <Button onClick={() => router.push('/')}>
                ダッシュボードに戻る
              </Button>
            </>
          ) : (
            <>
              <Button 
                type="primary" 
                onClick={goToLogin}
                style={{ marginRight: 10 }}
              >
                ログインページへ
              </Button>
              <Button onClick={checkSession}>
                状態を再確認
              </Button>
            </>
          )}
        </div>
      )}

      {currentStep === 1 && (
        <div style={{ textAlign: 'center' }}>
          <Spin size="large" />
          <Title level={4} style={{ marginTop: 20 }}>
            セッションをクリア中...
          </Title>
          <Text>Cookieを削除して、Supabaseからログアウトしています。</Text>
        </div>
      )}

      {currentStep === 2 && (
        <Card style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>✅</div>
          <Title level={3} style={{ marginBottom: 10 }}>
            セッションクリア完了！
          </Title>
          <Text style={{ display: 'block', marginBottom: 20 }}>
            すべてのセッション情報がクリアされました。
          </Text>
          <Button type="primary" onClick={goToLogin}>
            ログインページでGoogle OAuthをテスト
          </Button>
          <Button style={{ marginLeft: 10 }} onClick={() => window.location.reload()}>
            状態を再確認
          </Button>
        </Card>
      )}

      {currentStep === 3 && (
        <Alert
          message="エラーが発生しました"
          description="セッションのクリア中にエラーが発生しました。ブラウザを再起動してみてください。"
          type="error"
          showIcon
          action={
            <Button size="small" danger onClick={() => window.location.reload()}>
              再試行
            </Button>
          }
        />
      )}

      <Card style={{ marginTop: 20 }}>
        <Title level={4}>テスト手順</Title>
        <ol>
          <li>このページで現在のセッションを確認</li>
          <li>セッションがあれば「セッションをクリア」をクリック</li>
          <li>シークレットウィンドウ（プライベートブラウジング）を開く</li>
          <li>シークレットウィンドウで http://localhost:3000/login にアクセス</li>
          <li>「Googleでログイン」をクリック</li>
          <li>認証後にダッシュボードにリダイレクトされるか確認</li>
        </ol>
      </Card>
    </div>
  );
}