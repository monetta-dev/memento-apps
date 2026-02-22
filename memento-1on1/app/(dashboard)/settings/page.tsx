'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { Typography, Card, Switch, Avatar, Button, message, Spin, Tag, Select, Input } from 'antd';
import { CalendarOutlined, MessageOutlined, LinkOutlined, DisconnectOutlined, GoogleOutlined } from '@ant-design/icons';
import { createClientComponentClient, getOAuthRedirectUrl } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

type LineSettings = {
  id: string;
  line_user_id: string;
  enabled: boolean;
  line_display_name?: string;
  is_friend?: boolean;
};

type BusinessMessagingProvider = 'slack' | 'chatwork' | 'lineworks';

type BusinessIntegration = {
  provider: BusinessMessagingProvider;
  webhookUrl?: string;
  apiToken?: string;
  roomId?: string;
  enabled: boolean;
};

const { Title } = Typography;

function SettingsPageContent() {
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
  // 業務メッセージサービス連携
  const [businessIntegrations, setBusinessIntegrations] = useState<Partial<Record<BusinessMessagingProvider, BusinessIntegration>>>({})
  const [chatworkRooms, setChatworkRooms] = useState<{ id: number; name: string }[]>([]);
  const [chatworkSelectedRoom, setChatworkSelectedRoom] = useState<number | null>(null);
  const [chatworkRoomSaving, setChatworkRoomSaving] = useState(false);
  const [businessLoading, setBusinessLoading] = useState<BusinessMessagingProvider | null>(null);
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();

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

  // 業務メッセージ連携の読み込み
  useEffect(() => {
    const fetchBusinessIntegrations = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('messaging_integrations')
        .select('provider, webhook_url, api_token, room_id, enabled')
        .eq('user_id', user.id)
        .eq('enabled', true);
      if (data) {
        const map: Partial<Record<BusinessMessagingProvider, BusinessIntegration>> = {};
        data.forEach((row: { provider: string; webhook_url?: string; api_token?: string; room_id?: string; enabled: boolean }) => {
          const p = row.provider as BusinessMessagingProvider;
          map[p] = { provider: p, webhookUrl: row.webhook_url ?? undefined, apiToken: row.api_token ?? undefined, roomId: row.room_id ?? undefined, enabled: row.enabled };
        });
        setBusinessIntegrations(map);
      }
    };
    fetchBusinessIntegrations();
  }, [supabase]);

  // Slack OAuthコールバック検知
  useEffect(() => {
    const slackStatus = searchParams.get('slack');
    if (!slackStatus) return;
    if (slackStatus === 'connected') {
      const channel = searchParams.get('channel');
      message.success(`Slack${channel ? ` (#${channel})` : ''} を連携しました`);
      setBusinessIntegrations(prev => ({ ...prev, slack: { provider: 'slack', enabled: true } }));
    } else if (slackStatus === 'cancelled') {
      message.info('Slack連携をキャンセルしました');
    } else {
      const reason = searchParams.get('reason') || 'unknown';
      message.error(`Slack連携に失敗しました(${reason})`);
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('slack'); url.searchParams.delete('channel'); url.searchParams.delete('reason');
    window.history.replaceState({}, '', url.toString());
  }, [searchParams]);

  // Chatwork OAuthコールバック検知
  useEffect(() => {
    const cwStatus = searchParams.get('chatwork');
    if (!cwStatus) return;
    if (cwStatus === 'select_room') {
      const roomsParam = searchParams.get('rooms');
      if (roomsParam) {
        // base64url → base64 変換してからデコード（日本語文字化け対策）
        const base64 = roomsParam.replace(/-/g, '+').replace(/_/g, '/');
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const decoded = new TextDecoder().decode(bytes);
        const rooms = JSON.parse(decoded) as { id: number; name: string }[];
        setChatworkRooms(rooms);
      }
    } else if (cwStatus === 'cancelled') {
      message.info('Chatwork連携をキャンセルしました');
    } else if (cwStatus === 'error') {
      const reason = searchParams.get('reason') || 'unknown';
      message.error(`Chatwork連携に失敗しました (${reason})`);
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('chatwork'); url.searchParams.delete('rooms'); url.searchParams.delete('reason'); url.searchParams.delete('v');
    window.history.replaceState({}, '', url.toString());
  }, [searchParams]);

  // LINE Works OAuthコールバック検知
  useEffect(() => {
    const lwStatus = searchParams.get('lineworks');
    if (!lwStatus) return;
    if (lwStatus === 'connected') {
      message.success('LINE Works を連携しました');
      setBusinessIntegrations(prev => ({ ...prev, lineworks: { provider: 'lineworks', enabled: true } }));
    } else if (lwStatus === 'cancelled') {
      message.info('LINE Works連携をキャンセルしました');
    } else if (lwStatus === 'error') {
      const reason = searchParams.get('reason') || 'unknown';
      message.error(`LINE Works連携に失敗しました (${reason})`);
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('lineworks'); url.searchParams.delete('reason'); url.searchParams.delete('v');
    window.history.replaceState({}, '', url.toString());
  }, [searchParams]);

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
      message.error(`Googleカレンダーの連携に失敗しました: ${errorMessage} `);
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
      message.error(`友達状態の確認に失敗しました: ${errorMessage} `);
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
      message.error(`LINE連携に失敗しました: ${errorMessage} `);
    } finally {
      console.log('🔍 LINE Connect Debug - Frontend End (loading stopped)');
      setLineLoading(false);
    }
  };

  const handleLineDisconnect = async () => {
    try {
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
      setLineConnected(false);
      message.success('LINE連携を解除しました（モック実装）');
    }
  };

  const handleBusinessConnect = async (provider: BusinessMessagingProvider) => {
    setBusinessLoading(provider);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      const body: Record<string, string> = { userId: user.id, provider };
      if (provider === 'slack' || provider === 'chatwork') {
        // OAuth経由のためこのルートは使用しない
        return;
      }

      const res = await fetch('/api/messaging/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error((await res.json()).error || '連携に失敗しました');

      setBusinessIntegrations(prev => ({ ...prev, [provider]: { provider, enabled: true } }));
      message.success(`${provider} 連携を設定しました`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '連携に失敗しました');
    } finally {
      setBusinessLoading(null);
    }
  };

  const handleBusinessDisconnect = async (provider: BusinessMessagingProvider) => {
    setBusinessLoading(provider);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');
      const res = await fetch('/api/messaging/disconnect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, provider })
      });
      if (!res.ok) throw new Error('切断に失敗しました');
      setBusinessIntegrations(prev => { const next = { ...prev }; delete next[provider]; return next; });
      message.success(`${provider} 連携を解除しました`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '切断に失敗しました');
    } finally {
      setBusinessLoading(null);
    }
  };

  // Organization handling
  const [orgCode, setOrgCode] = useState('');
  const [joiningOrg, setJoiningOrg] = useState(false);
  const [currentOrg, setCurrentOrg] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const fetchOrg = async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('organization_id, organizations(name, code)').eq('id', user.id).single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (profile?.organizations) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const org = profile.organizations as any;
        setCurrentOrg({ id: profile.organization_id, name: org.name });
      }
    };
    fetchOrg();
  }, [supabase]);

  const handleJoinOrg = async () => {
    if (!orgCode) return;
    setJoiningOrg(true);
    try {
      const response = await fetch('/api/organizations/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: orgCode })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join organization');
      }

      setCurrentOrg({ id: data.organization.id, name: data.organization.name });
      message.success(`${data.organization.name} に参加しました！`);
      setOrgCode('');
    } catch (err) {
      console.error(err);
      message.error(err instanceof Error ? err.message : '参加に失敗しました。');
    } finally {
      setJoiningOrg(false);
    }
  };

  // Define integrations is inside render or needs to be moved if used here. 
  // Wait, `integrations` array was defined inside the component scope in original file.
  // I need to be careful with where I insert this.
  // The ReplacementContent replaces lines 320-341 (handleLineDisconnect).
  // This is fine, I am appending the new Orgnization logic after it.
  // But wait, `integrations` array is defined at line 344 in original file.
  // So I am inserting logic BEFORE `integrations` definition.
  // The UI rendering part needs to be updated too.
  // I should use a MULTI-REPLACE or just replace the JSX part separately.
  // Let's replace `handleLineDisconnect` AND insert the state/effects.
  // But I also need to update the JSX to show the Organization card.

  // Let's do state/logic insertion first.



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
      title: 'LINE (個人用 - 廃止予定)',
      description: (
        <>
          <div style={{ marginBottom: 4 }}>
            {lineConnected && lineSettings?.is_friend === false
              ? 'LINE連携済み（友だち追加が必要）'
              : 'リマインダーや通知をLINEで送信します。'}
          </div>
          <Tag color="orange" style={{ fontSize: '10px' }}>⚠️ LINE Worksへの移行を推奨しています</Tag>
        </>
      ),
      icon: <MessageOutlined style={{ color: '#52c41a' }} />,
      connected: lineConnected,
      loading: lineLoading,
      disabled: false,
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

      <Card title="組織設定" variant="borderless" className="wafu-card" style={{ marginBottom: 24 }}>
        {currentOrg ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>現在の所属</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#223a70' }}>{currentOrg.name}</div>
            </div>
            <Tag color="blue">参加済み</Tag>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 8, fontWeight: 600 }}>組織コードを入力して参加</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  placeholder="例: MEMENTO-2024"
                  value={orgCode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrgCode(e.target.value)}
                  style={{ maxWidth: 300 }}
                />
                <Button type="primary" onClick={handleJoinOrg} loading={joiningOrg} disabled={!orgCode}>
                  参加する
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

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
                          <div style={{ width: 150, height: 150, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <QRCodeSVG value={process.env.NEXT_PUBLIC_LINE_FRIEND_URL || 'https://lin.ee/z7uMKon'} size={150} level="H" includeMargin={false} bgColor="#ffffff" fgColor="#000000" />
                          </div>
                          <div style={{ marginTop: 8, fontSize: '11px', color: '#666' }}>※ QRコードが読み取れない場合は、URLを直接開いてください</div>
                        </div>
                        <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
                          <Button type="primary" size="small" onClick={() => window.open(process.env.NEXT_PUBLIC_LINE_FRIEND_URL || 'https://lin.ee/z7uMKon', '_blank')}>LINEで友だち追加</Button>
                          <Button type="default" size="small" onClick={handleCheckFriendStatus} loading={lineLoading} disabled={lineLoading}>状態を更新</Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginLeft: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                {item.isGoogleCalendar ? (
                  isGoogleAuth ? (
                    <Tag color="success" style={{ margin: 0 }}>連携可能</Tag>
                  ) : (
                    <Button type="primary" size="small" icon={<GoogleOutlined />} onClick={item.onConnect} loading={item.loading} disabled={item.disabled || item.loading}>Googleでサインイン</Button>
                  )
                ) : (
                  <>
                    <Switch checkedChildren="連携中" unCheckedChildren="未連携" checked={item.connected} onChange={(checked) => checked ? item.onConnect() : item.onDisconnect()} loading={item.loading} disabled={item.disabled || item.loading} />
                    <Button type="default" size="small" icon={item.connected ? <DisconnectOutlined /> : <LinkOutlined />} onClick={item.connected ? item.onDisconnect : item.onConnect} loading={item.loading} disabled={item.disabled || item.loading}>
                      {item.connected ? '切断' : '接続'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 業務メッセージサービス連携 */}
        <div style={{ marginTop: 24, borderTop: '1px solid #f0f0f0', paddingTop: 20 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 16, fontSize: '14px', color: '#595959' }}>💼 業務メッセージサービス（セッション後の総括を自動送信）</div>

          {/* Slack */}
          <div style={{ marginBottom: 20, padding: '16px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '20px' }}>💬</span>
                <span style={{ fontWeight: 'bold' }}>Slack</span>
                {businessIntegrations.slack
                  ? <Tag color="success">連携済み</Tag>
                  : <Tag color="default">未連携</Tag>
                }
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {businessIntegrations.slack && process.env.NODE_ENV === 'development' && (
                  <Button
                    size="small"
                    onClick={async () => {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) { message.error('ログインしてください'); return; }
                      const res = await fetch('/api/messaging/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          userId: user.id,
                          provider: 'slack',
                          message: '🧪 これはMemento 1on1からのテストメッセージです。Slack連携が正しく機能しています！',
                        }),
                      });
                      if (res.ok) message.success('テストメッセージを送信しました');
                      else message.error('送信に失敗しました');
                    }}
                  >
                    テスト送信
                  </Button>
                )}
                <Button
                  type="primary"
                  icon={<span style={{ marginRight: 4 }}>💬</span>}
                  onClick={() => { window.location.href = '/api/slack/authorize'; }}
                >
                  {businessIntegrations.slack ? 'Slackで再連携' : 'Slackで連携する'}
                </Button>
                {businessIntegrations.slack && (
                  <Button danger loading={businessLoading === 'slack'} onClick={() => handleBusinessDisconnect('slack')}>切断</Button>
                )}
              </div>
            </div>
            {businessIntegrations.slack && (
              <div style={{ marginTop: 10, fontSize: '13px', color: '#52c41a' }}>
                ✅ Slackチャンネルへの送信が有効です。セッション終了時に総括が自動送信されます。
              </div>
            )}
            {!businessIntegrations.slack && (
              <div style={{ marginTop: 8, fontSize: '12px', color: '#8c8c8c' }}>ボタンをクリックするとSlackの認証画面が開きます。送信先チャンネルを選ぶだけで完了します。</div>
            )}
          </div>

          {/* Chatwork */}
          <div style={{ padding: '16px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '20px' }}>💼</span>
                <span style={{ fontWeight: 'bold' }}>Chatwork</span>
                {businessIntegrations.chatwork
                  ? <Tag color="success">連携済み</Tag>
                  : <Tag color="default">未連携</Tag>
                }
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {businessIntegrations.chatwork && process.env.NODE_ENV === 'development' && (
                  <Button
                    size="small"
                    onClick={async () => {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) { message.error('ログインしてください'); return; }
                      const res = await fetch('/api/messaging/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          userId: user.id, provider: 'chatwork',
                          message: '🧪 これはMemento 1on1からのテストメッセージです。Chatwork連携が正しく機能しています！',
                        }),
                      });
                      if (res.ok) message.success('テストメッセージを送信しました');
                      else { const d = await res.json(); message.error(`送信失敗: ${d.details || d.error}`); }
                    }}
                  >テスト送信</Button>
                )}
                <Button
                  type="primary"
                  icon={<span style={{ marginRight: 4 }}>💼</span>}
                  onClick={() => { window.location.href = '/api/chatwork/authorize'; }}
                >
                  {businessIntegrations.chatwork ? 'Chatworkで再連携' : 'Chatworkで連携する'}
                </Button>
                {businessIntegrations.chatwork && (
                  <Button danger loading={businessLoading === 'chatwork'} onClick={() => handleBusinessDisconnect('chatwork')}>切断</Button>
                )}
              </div>
            </div>

            {/* ルーム選択（OAuth後に表示） */}
            {chatworkRooms.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', color: '#595959' }}>💬 送信先ルームを選んでください：</span>
                <Select
                  style={{ minWidth: 240 }}
                  placeholder="ルームを選択"
                  value={chatworkSelectedRoom}
                  onChange={val => setChatworkSelectedRoom(val)}
                  options={chatworkRooms.map(r => ({ value: r.id, label: r.name }))}
                />
                <Button
                  type="primary"
                  loading={chatworkRoomSaving}
                  disabled={chatworkSelectedRoom === null}
                  onClick={async () => {
                    if (chatworkSelectedRoom === null) return;
                    setChatworkRoomSaving(true);
                    const room = chatworkRooms.find(r => r.id === chatworkSelectedRoom);
                    const res = await fetch('/api/chatwork/select-room', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ roomId: chatworkSelectedRoom, roomName: room?.name ?? '' }),
                    });
                    setChatworkRoomSaving(false);
                    if (res.ok) {
                      message.success(`Chatwork #${room?.name} を連携しました`);
                      setChatworkRooms([]);
                      setChatworkSelectedRoom(null);
                      setBusinessIntegrations(prev => ({
                        ...prev,
                        chatwork: { provider: 'chatwork', roomId: String(chatworkSelectedRoom), enabled: true },
                      }));
                    } else {
                      message.error('ルームの保存に失敗しました');
                    }
                  }}
                >このルームに送信</Button>
              </div>
            )}

            {businessIntegrations.chatwork && chatworkRooms.length === 0 && (
              <div style={{ marginTop: 10, fontSize: '13px', color: '#52c41a' }}>
                ✅ Chatworkルームへの送信が有効です。セッション終了時に総括が自動送信されます。
              </div>
            )}
            {!businessIntegrations.chatwork && chatworkRooms.length === 0 && (
              <div style={{ marginTop: 8, fontSize: '12px', color: '#8c8c8c' }}>ボタンをクリックするとChatworkの認証画面が開きます。認証後に送信先ルームを選ぶだけで完了します。</div>
            )}
          </div>

          {/* LINE Works */}
          <div style={{ marginTop: 20, padding: '16px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '20px' }}>🟢</span>
                <span style={{ fontWeight: 'bold' }}>LINE Works</span>
                {businessIntegrations.lineworks
                  ? <Tag color="success">連携済み</Tag>
                  : <Tag color="default">未連携</Tag>
                }
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {businessIntegrations.lineworks && process.env.NODE_ENV === 'development' && (
                  <Button
                    size="small"
                    onClick={async () => {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) { message.error('ログインしてください'); return; }
                      const res = await fetch('/api/messaging/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          userId: user.id, provider: 'lineworks',
                          message: '🧪 これはMemento 1on1からのテストメッセージです。LINE Works連携が正しく機能しています！',
                        }),
                      });
                      if (res.ok) message.success('テストメッセージを送信しました');
                      else { const d = await res.json(); message.error(`送信失敗: ${d.details || d.error}`); }
                    }}
                  >テスト送信</Button>
                )}
                <Button
                  type="primary"
                  icon={<span style={{ marginRight: 4 }}>🟢</span>}
                  onClick={() => { window.location.href = '/api/lineworks/authorize'; }}
                >
                  {businessIntegrations.lineworks ? 'LINE Worksで再連携' : 'LINE Worksで連携する'}
                </Button>
                {businessIntegrations.lineworks && (
                  <Button danger loading={businessLoading === 'lineworks'} onClick={() => handleBusinessDisconnect('lineworks')}>切断</Button>
                )}
              </div>
            </div>
            {businessIntegrations.lineworks && (
              <div style={{ marginTop: 10, fontSize: '13px', color: '#52c41a' }}>
                ✅ LINE Worksへの送信が有効です。セッション終了時に総括が自動送信されます。
              </div>
            )}
            {!businessIntegrations.lineworks && (
              <div style={{ marginTop: 8, fontSize: '12px', color: '#8c8c8c' }}>法人の管理者がBotを有効化している必要があります。ボタンをクリックして認証を完了させてください。</div>
            )}
          </div>
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

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f5f7fa' }}>
        <Spin size="large" tip="設定を読み込んでいます..." />
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  );
}
