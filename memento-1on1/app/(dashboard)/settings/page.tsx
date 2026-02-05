'use client';

import React, { useEffect, useState } from 'react';
import { Typography, Card, Switch, Avatar, Button, message, Spin, Tag, Select } from 'antd';
import { CalendarOutlined, MessageOutlined, LinkOutlined, DisconnectOutlined, GoogleOutlined } from '@ant-design/icons';
import { createClientComponentClient, getOAuthRedirectUrl } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

type LineSettings = {
  id: string;
  line_user_id: string;
  enabled: boolean;
  line_display_name?: string;
  is_friend?: boolean;
};

const { Title } = Typography;

export default function SettingsPage() {
  const router = useRouter();
  // Removed custom language hook - hardcoding Japanese
  const [googleConnected, setGoogleConnected] = useState(false);
  const [lineConnected, setLineConnected] = useState(false);
  const [lineSettings, setLineSettings] = useState<LineSettings | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [lineLoading, setLineLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userEmail, setUserEmail] = useState<string>('');
  const [isGoogleAuth, setIsGoogleAuth] = useState(false);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          router.push('/login');
          return;
        }

        setUserEmail(session.user.email || '');

        // Check if user logged in with Google OAuth
        const isGoogleUser = !!session.provider_token;
        setIsGoogleAuth(isGoogleUser);

        // Check if user has Google connected (check DB via API)
        try {
          const tokenResponse = await fetch('/api/google-calendar/get-token');
          setGoogleConnected(tokenResponse.ok);
        } catch (e) {
          console.error('Failed to check google status', e);
          setGoogleConnected(false);
        }

        // Check LINE connection status from database
        try {
          console.log('🔍 Checking LINE connection status for user:', session.user.id);

          const { data: lineData, error: lineError } = await supabase
            .from('line_notifications')
            .select('id, line_user_id, enabled, line_display_name, is_friend, created_at, updated_at')
            .eq('user_id', session.user.id)
            .eq('enabled', true)
            .not('line_user_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          console.log('🔍 LINE connection check result:', {
            hasData: !!lineData,
            error: lineError,
            data: lineData ? {
              id: lineData.id,
              line_user_id: lineData.line_user_id ? '[SET]' : '[MISSING]',
              enabled: lineData.enabled,
              is_friend: lineData.is_friend,
              line_display_name: lineData.line_display_name,
              created_at: lineData.created_at
            } : null
          });

          if (!lineError && lineData) {
            setLineConnected(true);
            setLineSettings(lineData);
            console.log('✅ LINE connected for user:', session.user.id, 'LINE user:', lineData.line_display_name, 'is_friend:', lineData.is_friend);
          } else {
            setLineConnected(false);
            console.log('⚠️ LINE not connected or error:', lineError?.message || 'No data found');

            // デバッグ: ユーザーの全レコードをチェック
            const { data: allRecords } = await supabase
              .from('line_notifications')
              .select('id, enabled, line_user_id, is_friend, created_at')
              .eq('user_id', session.user.id)
              .order('created_at', { ascending: false });

            console.log('🔍 All LINE records for user:', allRecords?.map(r => ({
              id: r.id,
              enabled: r.enabled,
              has_line_user_id: !!r.line_user_id,
              is_friend: r.is_friend,
              created_at: r.created_at
            })));
          }
        } catch (error) {
          console.error('❌ Error checking LINE connection:', error);
          setLineConnected(false);
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        router.push('/login');
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAuthStatus();
  }, [supabase, router]);

  const handleGoogleConnect = async () => {
    setGoogleLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { data: _, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getOAuthRedirectUrl(),
          scopes: 'https://www.googleapis.com/auth/calendar.events',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) throw error;

      // OAuth flow will redirect, so we don't need to update state here
      message.info('Google認証にリダイレクト中...');
    } catch (error: unknown) {
      console.error('Google OAuth error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      message.error(`Googleカレンダーの連携に失敗しました: ${errorMessage}`);
      setGoogleLoading(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    setGoogleLoading(true);
    try {
      // DBのトークンを削除するAPIを呼ぶ (まだ実装していないが、UI上は切断状態にする)
      // 理想的には /api/google-calendar/disconnect を作るべき

      const { error } = await supabase
        .from('profiles')
        .update({
          google_access_token: null,
          google_refresh_token: null,
          google_token_expires_at: null
        })
        .eq('id', (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;

      setGoogleConnected(false);
      message.success('Googleカレンダーの連携を解除しました');
    } catch (error) {
      console.error('Error disconnecting Google:', error);
      message.error('Googleカレンダーの切断に失敗しました');
    } finally {
      setGoogleLoading(false);
    }
  };

  const refreshLineStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      console.log('🔍 Refreshing LINE connection status for user:', session.user.id);

      const { data: lineData, error: lineError } = await supabase
        .from('line_notifications')
        .select('id, line_user_id, enabled, line_display_name, is_friend, created_at, updated_at')
        .eq('user_id', session.user.id)
        .eq('enabled', true)
        .not('line_user_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('🔍 LINE refresh result:', {
        hasData: !!lineData,
        error: lineError,
        is_friend: lineData?.is_friend
      });

      if (!lineError && lineData) {
        setLineConnected(true);
        setLineSettings(lineData);
        console.log('✅ LINE status refreshed:', lineData.line_display_name, 'is_friend:', lineData.is_friend);
      } else {
        setLineConnected(false);
        console.log('⚠️ LINE not connected or error:', lineError?.message || 'No data found');
      }
    } catch (error) {
      console.error('❌ Error refreshing LINE status:', error);
    }
  };

  const handleCheckFriendStatus = async () => {
    setLineLoading(true);
    try {
      console.log('🔍 Checking friend status...');
      message.info('友達状態を確認中...');

      const response = await fetch('/api/line/check-friend-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();
      console.log('🔍 Check friend status result:', result);

      if (response.ok && result.success) {
        message.success(result.message);
        // LINE設定を再取得
        await refreshLineStatus();
      } else {
        throw new Error(result.error || result.details || '友達状態の確認に失敗しました');
      }
    } catch (error: unknown) {
      console.error('❌ Friend status check error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      message.error(`友達状態の確認に失敗しました: ${errorMessage}`);
    } finally {
      setLineLoading(false);
    }
  };

  const handleLineConnect = async (reconnect = false) => {
    // 既に連携済みでis_friend=falseの場合、再連携は不要（QRコード表示で十分）
    if (lineConnected && lineSettings?.is_friend === false) {
      console.log('🔍 User has is_friend=false, showing QR code instead of reconnecting');
      message.info('既にLINE連携済みです。友だち追加にはQRコードをご利用ください。');
      setLineLoading(false);
      return;
    }

    setLineLoading(true);
    try {
      console.log('🔍 LINE Connect Debug - Frontend Start');
      console.log('🔍 User:', userEmail);
      console.log('🔍 reconnect parameter:', reconnect);
      console.log('🔍 Current lineSettings:', lineSettings);
      console.log('🔍 is_friend status:', lineSettings?.is_friend);
      console.log('🔍 lineConnected status:', lineConnected);

      const response = await fetch('/api/line/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userEmail, reconnect })
      });

      console.log('🔍 Connect API Response:', {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      const result = await response.json();
      console.log('🔍 Connect API Result:', result);
      console.log('🔍 oauthUrl present:', !!result.oauthUrl);

      if (response.ok && result.success) {
        if (result.oauthUrl) {
          console.log('🔍 Redirecting to LINE OAuth URL:', result.oauthUrl);
          console.log('🔍 LINE Connect Debug - Frontend End (redirecting)');
          try {
            window.location.href = result.oauthUrl;
          } catch (err) {
            console.error('❌ Redirect failed:', err);
            message.error('リダイレクトに失敗しました');
          }
          // リダイレクトされるのでここで処理終了
          return;
        } else {
          // oauthUrlがない場合（モックモードなど）
          console.log('🔍 No OAuth URL returned (mock mode)');
          setLineConnected(true);
          message.success(result.message || 'LINE連携を開始しました');
        }
      } else {
        console.error('❌ Connect API returned error:', {
          status: response.status,
          result: result,
          reconnectParameter: reconnect
        });
        throw new Error(result.error || result.details || 'LINE連携に失敗しました');
      }
    } catch (error: unknown) {
      console.error('❌ LINE connect error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error details:', {
        errorMessage,
        user: userEmail,
        reconnectParameter: reconnect,
        lineSettings
      });
      message.error(`LINE連携に失敗しました: ${errorMessage}`);
    } finally {
      console.log('🔍 LINE Connect Debug - Frontend End (loading stopped)');
      setLineLoading(false);
    }
  };

  const handleLineDisconnect = async () => {
    try {
      // モック実装: LINE連携解除API
      const response = await fetch('/api/line/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userEmail })
      });

      if (response.ok) {
        setLineConnected(false);
        message.success('LINE連携を解除しました');
      } else {
        throw new Error('LINE連携解除に失敗しました');
      }
    } catch (error) {
      console.error('LINE disconnect error:', error);
      // モックフォールバック
      setLineConnected(false);
      message.success('LINE連携を解除しました（モック実装）');
    }
  };


  const integrations = [
    {
      id: 'google-calendar',
      title: 'Googleカレンダー',
      description: isGoogleAuth
        ? 'カレンダー連携が利用可能です'
        : 'Googleでサインインしてカレンダー連携を有効にしてください',
      icon: <CalendarOutlined style={{ color: '#fadb14' }} />,
      connected: googleConnected,
      loading: googleLoading,
      disabled: googleLoading,
      onConnect: handleGoogleConnect,
      onDisconnect: isGoogleAuth ? handleGoogleDisconnect : () => { },
      isGoogleCalendar: true,
    },
    {
      id: 'line',
      title: 'LINE',
      description: lineConnected && lineSettings?.is_friend === false
        ? 'LINE連携済み（友だち追加が必要）'
        : 'リマインダーや通知をLINEで送信します。',
      icon: <MessageOutlined style={{ color: '#52c41a' }} />,
      connected: lineConnected,
      loading: lineLoading,
      disabled: false,
      // is_friend=falseの場合はQRコード表示、それ以外は通常の連携フロー
      onConnect: () => handleLineConnect(false),
      onDisconnect: handleLineDisconnect,
      isGoogleCalendar: false,
    },
  ];

  if (checkingAuth) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <Spin>認証ステータスを確認中...</Spin>
      </div>
    );
  }

  return (
    <div>
      <Title level={2} style={{ margin: 0 }}>設定</Title>

      <Card title="連携" variant="borderless" className="wafu-card">
        <div className="ant-list ant-list-split">
          {integrations.map((item) => (
            <div key={item.id} className="ant-list-item brush-border-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
              <div className="ant-list-item-meta" style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div className="ant-list-item-meta-avatar" style={{ marginRight: 16 }}>
                  <Avatar icon={item.icon} style={{ backgroundColor: 'var(--background)', border: '1px solid currentColor', color: 'var(--foreground)' }} />
                </div>
                <div className="ant-list-item-meta-content">
                  <h4 className="ant-list-item-meta-title" style={{ marginBottom: 4, fontFamily: 'var(--font-serif)' }}>{item.title}</h4>
                  <div className="ant-list-item-meta-description" style={{ color: 'rgba(0, 0, 0, 0.45)' }}>{item.description}</div>
                  {item.id === 'line' && lineConnected && lineSettings?.is_friend === false && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ color: '#faad14', fontSize: '12px', marginBottom: 8 }}>
                        ⚠️ 友だち追加が完了していません。メッセージを受信するには追加が必要です。
                      </div>
                      <div style={{ background: 'rgba(183, 235, 143, 0.2)', border: '1px solid #b7eb8f', borderRadius: 4, padding: 12 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: 8 }}>友だち追加方法</div>
                        <ol style={{ margin: 0, paddingLeft: 20, fontSize: '12px' }}>
                          <li>LINEアプリを開く</li>
                          <li>友だち追加 → QRコード読み取り</li>
                          <li>以下のQRコードをスキャン</li>
                        </ol>
                        <div style={{ marginTop: 12, textAlign: 'center' }}>
                          {/* QRコード生成 */}
                          <div style={{
                            width: 150,
                            height: 150,
                            margin: '0 auto',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <QRCodeSVG
                              value={process.env.NEXT_PUBLIC_LINE_FRIEND_URL || 'https://lin.ee/z7uMKon'}
                              size={150}
                              level="H"
                              includeMargin={false}
                              bgColor="#ffffff"
                              fgColor="#000000"
                            />
                          </div>
                          <div style={{ marginTop: 8, fontSize: '11px', color: '#666' }}>
                            ※ QRコードが読み取れない場合は、URLを直接開いてください
                          </div>
                        </div>
                        <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
                          <Button
                            type="primary"
                            size="small"
                            onClick={() => window.open(process.env.NEXT_PUBLIC_LINE_FRIEND_URL || 'https://lin.ee/z7uMKon', '_blank')}
                          >
                            LINEで友だち追加
                          </Button>
                          <Button
                            type="default"
                            size="small"
                            onClick={handleCheckFriendStatus}
                            loading={lineLoading}
                            disabled={lineLoading}
                          >
                            状態を更新
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginLeft: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                {item.isGoogleCalendar ? (
                  // Google Calendar: Show status tag for Google auth users, button for email auth users
                  isGoogleAuth ? (
                    <Tag color="success" style={{ margin: 0 }}>連携可能</Tag>
                  ) : (
                    <Button
                      type="primary"
                      size="small"
                      icon={<GoogleOutlined />}
                      onClick={item.onConnect}
                      loading={item.loading}
                      disabled={item.disabled || item.loading}
                    >
                      Googleでサインイン
                    </Button>
                  )
                ) : (
                  // LINE: Keep existing switch and button
                  <>
                    <Switch
                      checkedChildren="連携中"
                      unCheckedChildren="未連携"
                      checked={item.connected}
                      onChange={(checked) => checked ? item.onConnect() : item.onDisconnect()}
                      loading={item.loading}
                      disabled={item.disabled || item.loading}
                    />
                    <Button
                      type="default"
                      size="small"
                      icon={item.connected ? <DisconnectOutlined /> : <LinkOutlined />}
                      onClick={item.connected ? item.onDisconnect : item.onConnect}
                      loading={item.loading}
                      disabled={item.disabled || item.loading}
                    >
                      {item.connected ? '切断' : '接続'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, padding: 12, background: isGoogleAuth ? 'rgba(183, 235, 143, 0.1)' : 'rgba(255, 251, 230, 0.5)', border: isGoogleAuth ? '1px solid #b7eb8f' : '1px solid #ffe58f', borderRadius: 4 }}>
          <Typography.Text type="secondary">
            {isGoogleAuth ? (
              <><strong>注意:</strong> Googleカレンダー連携が有効です。次回の1on1セッションをスケジュールできます。</>
            ) : (
              <><strong>制限:</strong> Googleカレンダー連携を使用するには、Googleアカウントでログインしてください。</>
            )}
          </Typography.Text>
        </div>
      </Card>
    </div >
  );
}
