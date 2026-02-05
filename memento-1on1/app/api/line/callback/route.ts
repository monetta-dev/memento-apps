import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@/lib/supabase';

 export async function GET(req: NextRequest) {
   try {
     const searchParams = req.nextUrl.searchParams;
     const code = searchParams.get('code');
     const state = searchParams.get('state');
     const error = searchParams.get('error');
     const errorDescription = searchParams.get('error_description');
     const siteUrl = process.env.LINE_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;

    // エラーチェック
    if (error) {
      console.error('LINE OAuth error:', error, errorDescription);
       return NextResponse.redirect(
         new URL('/settings?line_error=' + encodeURIComponent(errorDescription || error), siteUrl || req.url)
       );
    }

    if (!code || !state) {
      console.error('Missing code or state in callback');
       return NextResponse.redirect(
         new URL('/settings?line_error=Missing authentication parameters', siteUrl || req.url)
       );
    }

    // Cookieから保存したstateとユーザーIDを取得
    const cookieStore = await cookies();
    const savedState = cookieStore.get('line_oauth_state')?.value;
    const userId = cookieStore.get('line_oauth_user_id')?.value;

    // Cookieをクリア
    cookieStore.delete('line_oauth_state');
    cookieStore.delete('line_oauth_user_id');

    // Stateからbot_prompt情報を抽出（形式: {random}::{bot_prompt_value}）
    let botPromptFromState: 'aggressive' | 'normal' | null = null;
    let stateBase = state;
    if (savedState && savedState.includes('::')) {
      const parts = savedState.split('::');
      if (parts.length >= 2) {
        stateBase = parts[0]; // ランダム部分
        const botPromptPart = parts[1];
        if (botPromptPart === 'aggressive' || botPromptPart === 'normal') {
          botPromptFromState = botPromptPart;
          console.log('🔍 Extracted bot_prompt from state:', botPromptFromState);
        }
      }
    }

    // State検証（CSRF保護）- ランダム部分のみを比較
    if (!savedState || !savedState.startsWith(stateBase)) {
      console.error('Invalid state parameter:', { 
        savedState, 
        state, 
        stateBase,
        botPromptFromState 
      });
        return NextResponse.redirect(
          new URL('/settings?line_error=Invalid authentication state', siteUrl || req.url)
        );
    }

    console.log('🔍 State validation passed. bot_prompt from state:', botPromptFromState);

    if (!userId) {
      console.error('No user ID found in cookies');
       return NextResponse.redirect(
         new URL('/settings?line_error=Session expired', siteUrl || req.url)
       );
    }

     // LINE OAuth設定
     const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
     const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
     const redirectUri = process.env.LINE_REDIRECT_URI;

    if (!channelId || !channelSecret || !redirectUri) {
      console.error('Missing LINE configuration');
       return NextResponse.redirect(
         new URL('/settings?line_error=LINE configuration missing', siteUrl || req.url)
       );
    }

    // 1. アクセストークンの取得
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: channelId,
        client_secret: channelSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('LINE token exchange failed:', tokenResponse.status, errorText);
       return NextResponse.redirect(
         new URL('/settings?line_error=Failed to exchange token', siteUrl || req.url)
       );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2. ユーザープロフィールの取得
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!profileResponse.ok) {
      console.error('LINE profile fetch failed:', profileResponse.status);
      // トークンは取得できたので、プロフィールなしでも続行
    }

    let lineUserId = 'unknown';
    let lineDisplayName = 'LINE User';

    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      lineUserId = profileData.userId;
      lineDisplayName = profileData.displayName || 'LINE User';
    }

    // 友だち状態の確認（LINE Login APIを使用）
    let isFriend = false;
    
    // 詳細な診断ログ
    console.log('🔍 LINE Callback Debug - Start');
    console.log('🔍 Callback query parameters:', Object.fromEntries(searchParams.entries()));
    
    // 方法1: friendship_status_changed クエリパラメータをチェック
    const friendshipStatusChanged = searchParams.get('friendship_status_changed');
    console.log('🔍 friendship_status_changed value:', friendshipStatusChanged, '(type:', typeof friendshipStatusChanged, ')');
    
    // friendship_status_changed の解釈:
    // - true: ログイン中に友達状態が変更された（友達追加またはブロック解除）
    // - false: 状態が変更されなかった（既に友達であるか、友達追加しなかった）
    // - null/undefined: bot_promptパラメータが使われなかった、または同意画面が表示されなかった
    
    // 方法2: LINE Login APIで友達状態を確認
    let apiFriendFlag = false;
    let apiCheckSuccessful = false;
    let apiResponseStatus = 0;
    let apiErrorMessage = '';
    
    if (accessToken) {
      try {
        console.log('🔍 Checking friendship status with access token (length:', accessToken.length, ')...');
        const friendshipResponse = await fetch('https://api.line.me/friendship/v1/status', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        
        apiResponseStatus = friendshipResponse.status;
        
        if (friendshipResponse.ok) {
          const friendshipData = await friendshipResponse.json();
          apiFriendFlag = friendshipData.friendFlag === true;
          apiCheckSuccessful = true;
          console.log('✅ LINE API friend status check SUCCESS:', { 
            lineUserId, 
            apiFriendFlag, 
            friendshipStatusChanged,
            friendFlag: friendshipData.friendFlag,
            status: friendshipResponse.status,
            responseBody: friendshipData
          });
        } else {
          const errorText = await friendshipResponse.text();
          apiErrorMessage = errorText;
          console.warn('❌ Failed to fetch friendship status:', {
            status: friendshipResponse.status,
            errorText,
            lineUserId,
            accessTokenLength: accessToken.length
          });
        }
      } catch (error) {
        console.error('❌ Error checking LINE friend status:', {
          error: error instanceof Error ? error.message : String(error),
          lineUserId,
          accessTokenLength: accessToken ? accessToken.length : 0
        });
      }
    } else {
      console.warn('⚠️ No access token available for friendship check');
    }
    
    // シンプルなisFriend決定ロジック
    console.log('🔍 isFriend decision logic:', {
      friendshipStatusChanged,
      botPromptFromState,
      apiCheckSuccessful,
      apiFriendFlag,
      apiResponseStatus,
      apiErrorMessage: apiErrorMessage.substring(0, 100)
    });
    
    // シンプルな決定ロジック
    if (friendshipStatusChanged === 'true') {
      // friendship_status_changedがtrueの場合、友達状態が変更された
      isFriend = true;
      console.log('✅ Setting isFriend=true based on friendship_status_changed=true');
    } else if (apiCheckSuccessful) {
      // APIチェックが成功した場合、その結果を使用
      isFriend = apiFriendFlag;
      console.log('✅ Setting isFriend=', isFriend, 'based on API result');
    } else {
      // それ以外の場合は既存の値を維持（後で調整）
      console.log('⚠️ Using existing is_friend value (no clear indicator)');
    }
    
    console.log('🔍 Final isFriend value:', isFriend);

    // 3. データベースに保存
    // Create adapter for cookie store
    const cookieAdapter = {
      getAll: () => {
        const cookies = cookieStore.getAll();
        return cookies.map(cookie => ({
          name: cookie.name,
          value: cookie.value,
        }));
      },
      setAll: (cookies: { name: string; value: string; options: Record<string, unknown> }[]) => {
        cookies.forEach(cookie => {
          cookieStore.set(cookie.name, cookie.value, cookie.options);
        });
      },
    };
    
    const supabase = createRouteHandlerClient(cookieAdapter);
    
    // まず現在のセッションからユーザーIDを取得（Supabase Auth）
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.error('No Supabase session found');
       return NextResponse.redirect(
         new URL('/login?line_error=Please login first', siteUrl || req.url)
       );
    }

    const authUserId = session.user.id;
    
    // 既存のLINE通知設定を取得（is_friend値の保持のため）
    let existingIsFriend = false;
    try {
      const { data: existingRecord } = await supabase
        .from('line_notifications')
        .select('is_friend')
        .eq('user_id', authUserId)
        .maybeSingle();
      
      if (existingRecord) {
        existingIsFriend = existingRecord.is_friend === true;
        console.log('🔍 Existing record found, is_friend:', existingIsFriend);
      } else {
        console.log('🔍 No existing record found, using default is_friend=false');
      }
    } catch (error) {
      console.error('❌ Error fetching existing record:', error);
    }
    
    // is_friend値の最終調整（既存値の保持）
    if (friendshipStatusChanged === null && !apiCheckSuccessful) {
      // friendship_status_changed=null かつ APIチェック失敗の場合、既存値を保持
      isFriend = existingIsFriend;
      console.log('🔍 Using existing is_friend value:', isFriend, '(friendship_status_changed=null, API check failed)');
    }
    
    console.log('🔍 Final isFriend value after adjustment:', isFriend);

    // line_notificationsテーブルに保存または更新
    const { data: _, error: dbError } = await supabase
      .from('line_notifications')
      .upsert({
        user_id: authUserId,
        line_user_id: lineUserId,
        line_access_token: accessToken, // 注意: 実際は暗号化が必要
        line_display_name: lineDisplayName,
        enabled: true,
        notification_types: ['reminder'],
        remind_before_minutes: 60, // デフォルト1時間前
        is_friend: isFriend,
        friend_status_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (dbError) {
      console.error('Database error saving LINE notification settings:', dbError);
        return NextResponse.redirect(
          new URL('/settings?line_error=Failed to save LINE settings', siteUrl || req.url)
        );
    }

    console.log('LINE connection successful for user:', authUserId, 'LINE user:', lineDisplayName);

    // 4. 成功したら設定ページにリダイレクト
    const redirectBase = siteUrl || req.url;
    return NextResponse.redirect(
      new URL('/settings?line_success=LINE連携が完了しました', redirectBase)
    );

   } catch (error: unknown) {
    console.error('LINE callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const siteUrl = process.env.LINE_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
    const redirectBase = siteUrl || req.url;
    return NextResponse.redirect(
      new URL(`/settings?line_error=${encodeURIComponent(errorMessage)}`, redirectBase)
    );
  }
}