import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@/lib/supabase';

export async function POST(_req: NextRequest) {
  try {
    console.log('🔍 LINE Check Friend Status API called');
    
    // Supabaseクライアントを作成
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
    
    // セッションを確認
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.error('❌ No session found');
      return NextResponse.json({ 
        success: false, 
        error: 'ログインが必要です' 
      }, { status: 401 });
    }
    
    const authUserId = session.user.id;
    console.log('🔍 Authenticated user ID:', authUserId);
    
    // ユーザーのLINE設定を取得
    const { data: lineSettings, error: fetchError } = await supabase
      .from('line_notifications')
      .select('id, line_user_id, line_access_token, is_friend')
      .eq('user_id', authUserId)
      .eq('enabled', true)
      .not('line_access_token', 'is', null)
      .maybeSingle();
    
    if (fetchError || !lineSettings) {
      console.error('❌ Error fetching LINE settings:', fetchError);
      return NextResponse.json({ 
        success: false, 
        error: 'LINE設定が見つかりません' 
      }, { status: 404 });
    }
    
    console.log('🔍 Found LINE settings:', {
      lineUserId: lineSettings.line_user_id,
      hasAccessToken: !!lineSettings.line_access_token,
      currentIsFriend: lineSettings.is_friend
    });
    
    const accessToken = lineSettings.line_access_token;
    let isFriend = false;
    let apiCheckSuccessful = false;
    
    // LINE APIで友達状態を確認
    if (accessToken) {
      try {
        console.log('🔍 Checking friendship status with LINE API...');
        const friendshipResponse = await fetch('https://api.line.me/friendship/v1/status', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        
        if (friendshipResponse.ok) {
          const friendshipData = await friendshipResponse.json();
          isFriend = friendshipData.friendFlag === true;
          apiCheckSuccessful = true;
          
          console.log('✅ LINE API friend status check SUCCESS:', {
            lineUserId: lineSettings.line_user_id,
            isFriend,
            friendFlag: friendshipData.friendFlag,
            status: friendshipResponse.status
          });
        } else {
          const errorText = await friendshipResponse.text();
          console.error('❌ Failed to fetch friendship status:', {
            status: friendshipResponse.status,
            errorText,
            lineUserId: lineSettings.line_user_id
          });
        }
      } catch (error) {
        console.error('❌ Error checking LINE friend status:', {
          error: error instanceof Error ? error.message : String(error),
          lineUserId: lineSettings.line_user_id
        });
      }
    } else {
      console.error('❌ No access token available for friendship check');
    }
    
    // データベースを更新
    const updateData: {
      friend_status_checked_at: string;
      updated_at: string;
      is_friend?: boolean;
    } = {
      friend_status_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    if (apiCheckSuccessful) {
      // APIチェック成功時のみis_friendを更新
      updateData.is_friend = isFriend;
      console.log('🔍 Updating is_friend to:', isFriend);
    } else {
      // APIチェック失敗時は現状維持
      console.log('⚠️ API check failed, keeping existing is_friend value');
    }
    
    const { data: updatedData, error: updateError } = await supabase
      .from('line_notifications')
      .update(updateData)
      .eq('id', lineSettings.id)
      .select('is_friend, friend_status_checked_at')
      .single();
    
    if (updateError) {
      console.error('❌ Database update error:', updateError);
      return NextResponse.json({ 
        success: false, 
        error: 'データベースの更新に失敗しました',
        details: updateError.message
      }, { status: 500 });
    }
    
    console.log('✅ Friend status updated successfully:', {
      isFriend: updatedData.is_friend,
      checkedAt: updatedData.friend_status_checked_at
    });
    
    return NextResponse.json({
      success: true,
      isFriend: updatedData.is_friend,
      checkedAt: updatedData.friend_status_checked_at,
      message: apiCheckSuccessful 
        ? `友達状態を更新しました: ${isFriend ? '友達です' : '友達ではありません'}`
        : '状態を確認しました（APIチェック失敗のため現状維持）'
    });
    
  } catch (error: unknown) {
    console.error('❌ LINE check friend status error:', error);
    return NextResponse.json({ 
      success: false, 
      error: '友達状態の確認に失敗しました',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}