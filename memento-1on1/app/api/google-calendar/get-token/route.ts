import { createRouteHandlerClient } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const supabase = createRouteHandlerClient({
            getAll: () => cookieStore.getAll(),
            setAll: () => { },
        });

        // 1. セッション確認
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. DBからトークン取得
        const { data: profile } = await supabase
            .from('profiles')
            .select('google_access_token, google_refresh_token, google_token_expires_at')
            .eq('id', session.user.id)
            .single();

        if (!profile?.google_access_token) {
            return NextResponse.json({ error: 'No Google token found' }, { status: 404 });
        }

        // 3. 有効期限チェック
        const now = Date.now();
        // 余裕を持って5分前には期限切れとみなす
        const isExpired = !profile.google_token_expires_at || profile.google_token_expires_at < (now + 5 * 60 * 1000);

        if (!isExpired) {
            return NextResponse.json({ accessToken: profile.google_access_token });
        }

        // 4. トークンリフレッシュ
        console.log('Google access token expired, refreshing...');

        if (!profile.google_refresh_token) {
            return NextResponse.json({ error: 'Token expired and no refresh token available' }, { status: 400 });
        }

        const clientId = process.env.GOOGLE_CLIENT_ID || process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET;

        if (!clientId || !clientSecret) {
            console.error('Missing Google OAuth credentials in env');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: profile.google_refresh_token,
                grant_type: 'refresh_token',
            }),
        });

        const refreshData = await refreshResponse.json();

        if (!refreshResponse.ok) {
            console.error('Failed to refresh Google token:', refreshData);
            return NextResponse.json({
                error: 'Failed to refresh token',
                details: refreshData
            }, { status: refreshResponse.status });
        }

        const newAccessToken = refreshData.access_token;
        const newExpiresIn = refreshData.expires_in; // 秒単位
        const newExpiresAt = Date.now() + (newExpiresIn * 1000);

        // 5. 新しいトークンをDBに保存
        // リフレッシュトークン自体も新しくなる場合があるが、Googleは通常維持される。
        // レスポンスに新しいrefresh_tokenが含まれていればそれも更新する。
        const updates: any = {
            google_access_token: newAccessToken,
            google_token_expires_at: newExpiresAt,
            updated_at: new Date().toISOString(),
        };

        if (refreshData.refresh_token) {
            updates.google_refresh_token = refreshData.refresh_token;
        }

        await supabase
            .from('profiles')
            .update(updates)
            .eq('id', session.user.id);

        console.log('Successfully refreshed and saved Google token');

        return NextResponse.json({ accessToken: newAccessToken });

    } catch (error) {
        console.error('Error in get-token route:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
