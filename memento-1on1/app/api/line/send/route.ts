import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@/lib/supabase';
import { SupabaseClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  let userId: string | undefined;
  let sessionId: string | undefined;
  let notificationType: string | undefined;
  let customMessage: string | undefined;
  
  try {
    const requestData = await req.json();
    userId = requestData.userId;
    sessionId = requestData.sessionId;
    notificationType = requestData.notificationType;
    customMessage = requestData.message;
    
    if (!userId || !notificationType) {
      return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
    }

    // Cookieアダプターの作成
    const cookieStore = await cookies();
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
    
    // 1. ユーザーのLINE通知設定を取得
    const { data: lineSettings, error: lineError } = await supabase
      .from('line_notifications')
      .select('line_user_id, line_display_name, enabled, notification_types, is_friend')
      .eq('user_id', userId)
      .eq('enabled', true)
      .not('line_user_id', 'is', null)
      .single();

    if (lineError || !lineSettings) {
      console.error('LINE settings not found or user not connected:', lineError);
      return NextResponse.json({ 
        error: 'LINE連携が設定されていません',
        details: 'ユーザーがLINE連携を設定していないか、設定が無効です'
      }, { status: 400 });
    }

    // 2. 通知タイプが許可されているか確認
    const allowedTypes = Array.isArray(lineSettings.notification_types) 
      ? lineSettings.notification_types 
      : ['reminder'];
    if (!allowedTypes.includes(notificationType)) {
      return NextResponse.json({
        error: '通知タイプが許可されていません',
        details: `許可されている通知タイプ: ${allowedTypes.join(', ')}`
      }, { status: 400 });
    }

    // 2.5 友だち状態の確認
    if (lineSettings.is_friend === false) {
      return NextResponse.json({
        error: 'LINE公式アカウントと友だちになっていません',
        details: 'メッセージを送信するには公式アカウントを友だち追加してください',
        action: 'reconnect',
        reconnectUrl: '/api/line/connect'
      }, { status: 400 });
    }

    // 3. メッセージの準備
    const finalMessage = customMessage || getDefaultMessage(notificationType, lineSettings.line_display_name);
    const lineUserId = lineSettings.line_user_id;

    // 4. LINE Messaging APIに送信（チャネルアクセストークン使用）
    const channelAccessToken = process.env.LINE_MESSAGING_ACCESS_TOKEN;
    if (!channelAccessToken) {
      console.error('LINE_MESSAGING_ACCESS_TOKEN not found');
      return NextResponse.json({
        error: 'LINE通知設定が不足しています',
        details: 'LINE_MESSAGING_ACCESS_TOKEN環境変数を設定してください'
      }, { status: 500 });
    }

    const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [
          {
            type: 'text',
            text: finalMessage,
          }
        ]
      }),
    });

    if (!lineResponse.ok) {
      const errorText = await lineResponse.text();
      console.error('LINE API error:', lineResponse.status, errorText);
      
      // 通知ログに失敗記録
      await logNotification(supabase, {
        userId,
        sessionId,
        notificationType,
        message: finalMessage,
        status: 'failed',
        errorMessage: `LINE API error: ${lineResponse.status} ${errorText}`,
      });

      return NextResponse.json({
        success: false,
        error: 'LINE通知の送信に失敗しました',
        details: `LINE API error: ${lineResponse.status}`,
        notificationId: null,
        sentAt: null,
        isMock: false,
      }, { status: 500 });
    }

    // 5. 通知ログに成功記録
    const logData = await logNotification(supabase, {
      userId,
      sessionId,
      notificationType,
      message: finalMessage,
      status: 'sent',
      errorMessage: null as string | null,
    });

    console.log('LINE notification sent successfully:', {
      userId,
      lineUserId: lineSettings.line_user_id,
      notificationType,
      messageLength: finalMessage.length,
      logId: logData?.id,
    });

    return NextResponse.json({
      success: true,
      message: 'LINE通知を送信しました',
      notificationId: logData?.id || `notification-${Date.now()}`,
      sentAt: new Date().toISOString(),
      isMock: false,
    });

  } catch (error: unknown) {
    console.error('LINE send error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // エラー時のログ記録
    try {
      const cookieStore = await cookies();
      const cookieAdapter = {
        getAll: () => cookieStore.getAll().map(c => ({ name: c.name, value: c.value })),
        setAll: () => {},
      };
      const supabase = createRouteHandlerClient(cookieAdapter);
      await logNotification(supabase, {
        userId: userId || 'unknown',
        sessionId: sessionId || null,
        notificationType: 'error',
        message: 'LINE通知送信中にエラーが発生しました',
        status: 'failed',
        errorMessage,
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json({ 
      error: 'LINE通知の送信に失敗しました',
      details: errorMessage,
    }, { status: 500 });
  }
}

// デフォルトメッセージ生成
function getDefaultMessage(notificationType: string, displayName?: string): string {
  const name = displayName ? `${displayName}さん` : 'ユーザーさん';
  
  switch (notificationType) {
    case 'reminder':
      return `${name}、1on1セッションが1時間後に開始されます。準備をお願いします。`;
    case 'summary':
      return `${name}、1on1セッションのサマリーが作成されました。確認してください。`;
    case 'follow_up':
      return `${name}、1on1セッションのフォローアップ項目があります。確認をお願いします。`;
    default:
      return `${name}、Memento 1on1からの通知です。`;
  }
}

// 通知ログ記録
async function logNotification(
  supabase: SupabaseClient,
  data: {
    userId: string;
    sessionId?: string | null;
    notificationType: string;
    message: string;
    status: 'pending' | 'sent' | 'failed' | 'delivered';
    errorMessage?: string | null;
  }
) {
  try {
    const { data: logData, error } = await supabase
      .from('notification_logs')
      .insert({
        user_id: data.userId,
        session_id: data.sessionId,
        notification_type: data.notificationType,
        message: data.message,
        status: data.status,
        error_message: data.errorMessage,
        sent_at: data.status === 'sent' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to log notification:', error);
      return null;
    }

    return logData;
  } catch (error) {
    console.error('Error logging notification:', error);
    return null;
  }
}