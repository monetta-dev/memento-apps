import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'ユーザーIDが必要です' }, { status: 400 });
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
    
    // ユーザーのLINE通知設定を取得（アクセストークンがある場合、LINE APIで失効させるため）
    const { data: lineSettings, error: fetchError } = await supabase
      .from('line_notifications')
      .select('line_access_token, line_user_id')
      .eq('user_id', userId)
      .single();

    // LINEアクセストークンの失効（オプション）
    if (lineSettings?.line_access_token) {
      try {
        // LINE OAuthトークン失効エンドポイント
        // 注意: LINE LoginのアクセストークンはMessaging API用ではないが、
        // プライバシー保護のため失効させることが望ましい
        const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
        const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
        
        if (channelId && channelSecret) {
          await fetch('https://api.line.me/oauth2/v2.1/revoke', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              access_token: lineSettings.line_access_token,
              client_id: channelId,
              client_secret: channelSecret,
            }),
          });
          console.log('LINE access token revoked for user:', userId);
        }
      } catch (revokeError) {
        console.warn('Failed to revoke LINE access token:', revokeError);
        // トークン失効に失敗しても処理は続行
      }
    }

    // データベースからLINE通知設定を削除
    const { error: deleteError } = await supabase
      .from('line_notifications')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Database error deleting LINE notification settings:', deleteError);
      return NextResponse.json({ 
        error: 'LINE連携の解除に失敗しました',
        details: 'データベースの削除中にエラーが発生しました'
      }, { status: 500 });
    }

    console.log('LINE disconnected successfully for user:', userId);
    
    return NextResponse.json({
      success: true,
      message: 'LINE連携を解除しました',
      isMock: false
    });

  } catch (error: unknown) {
    console.error('LINE disconnect error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      error: 'LINE連携の解除に失敗しました',
      details: errorMessage
    }, { status: 500 });
  }
}