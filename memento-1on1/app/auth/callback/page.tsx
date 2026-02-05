'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // セッションを取得
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Session error:', error);
          router.push('/login');
          return;
        }

        if (session) {
          // Googleトークン情報を取得
          const { provider_token, provider_refresh_token, expires_in, user } = session;

          if (user && (provider_token || provider_refresh_token)) {
            console.log('Using persistent token storage. Updating profile with tokens...');

            // 有効期限を計算 (現在時刻 + expires_in秒)
            // expires_inは通常3600秒(1時間)
            const expiresAt = expires_in ? Date.now() + (expires_in * 1000) : undefined;

            try {
              const { error: updateError } = await supabase
                .from('profiles')
                .update({
                  google_access_token: provider_token,
                  google_refresh_token: provider_refresh_token, // 初回ログイン時のみ返されることが多い
                  google_token_expires_at: expiresAt,
                  updated_at: new Date().toISOString()
                })
                .eq('id', user.id);

              if (updateError) {
                console.error('Failed to update tokens in profile:', updateError);
              } else {
                console.log('Successfully updated tokens in profile');
              }
            } catch (err) {
              console.error('Error updating profile tokens:', err);
            }
          }

          // セッションがあればダッシュボードへ
          router.push('/');
        } else {
          // セッションがなければログインページへ
          router.push('/login');
        }
      } catch (err) {
        console.error('Callback error:', err);
        router.push('/login');
      }
    };

    handleCallback();
  }, [router, supabase]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <div style={{
        textAlign: 'center',
        color: 'white',
        padding: 20
      }}>
        <h1>認証処理中...</h1>
        <p>ログイン情報を確認しています。しばらくお待ちください。</p>
      </div>
    </div>
  );
}