import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

function createServiceRoleClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );
}

function parseAndVerifyState(state: string): { userId: string } | null {
    try {
        const { csrf, userId, sig } = JSON.parse(Buffer.from(state, 'base64url').toString()) as {
            csrf: string; userId: string; sig: string;
        };
        const payload = `${csrf}:${userId}`;
        const expectedSig = crypto
            .createHmac('sha256', process.env.CHATWORK_CLIENT_SECRET!)
            .update(payload)
            .digest('hex');
        if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
            return null;
        }
        return { userId };
    } catch {
        return null;
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';  // OAuth callback URI用
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || appUrl;                   // ユーザーへのリダイレクト用

    if (error) {
        return NextResponse.redirect(`${siteUrl}/settings?chatwork=cancelled`);
    }
    if (!code || !state) {
        return NextResponse.redirect(`${siteUrl}/settings?chatwork=error&reason=missing_params`);
    }

    const verified = parseAndVerifyState(state);
    if (!verified) {
        return NextResponse.redirect(`${siteUrl}/settings?chatwork=error&reason=invalid_state`);
    }
    const { userId } = verified;

    // コードをアクセストークンに交換
    const clientId = process.env.CHATWORK_CLIENT_ID!;
    const clientSecret = process.env.CHATWORK_CLIENT_SECRET!;
    const redirectUri = `${appUrl}/api/chatwork/callback`;

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch('https://oauth.chatwork.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`,
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
        }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
        console.error('Chatwork token exchange failed:', tokenData);
        return NextResponse.redirect(`${siteUrl}/settings?chatwork=error&reason=token_exchange_failed`);
    }

    // アクセストークンでルーム一覧を取得
    const roomsRes = await fetch('https://api.chatwork.com/v2/rooms', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const roomsData = await roomsRes.json();

    if (!Array.isArray(roomsData)) {
        console.error('Chatwork rooms fetch failed:', roomsData);
        return NextResponse.redirect(`${siteUrl}/settings?chatwork=error&reason=rooms_fetch_failed`);
    }

    // グループチャットとマイチャットを含める
    const groupRooms = roomsData
        .filter(r => r.type === 'group' || r.type === 'my')
        .map(r => ({ id: r.room_id, name: r.type === 'my' ? 'マイチャット' : r.name }));

    console.log(`Chatwork rooms found: ${groupRooms.length}`, groupRooms);

    console.log(`[DEBUG] Chatwork callback started for user: ${userId}`);

    // 一時的に access_token と rooms を DB に保存（room 未選択状態）
    const supabase = createServiceRoleClient();

    // 手動 upsert
    const { data: existing, error: selectError } = await supabase
        .from('messaging_integrations')
        .select('id')
        .eq('user_id', userId)
        .eq('provider', 'chatwork')
        .maybeSingle();

    if (selectError) {
        console.error('[DEBUG] Chatwork select error:', selectError);
        return NextResponse.redirect(`${siteUrl}/settings?chatwork=error&reason=db_error_select_${selectError.code || 'unknown'}`);
    }

    const payload = {
        user_id: userId,
        provider: 'chatwork',
        api_token: tokenData.access_token,
        webhook_url: null,
        room_id: null,
        display_name: 'Chatwork (ルーム未選択)',
        enabled: false,
        metadata: {
            rooms: groupRooms,
            scope: tokenData.scope,
            refresh_token: tokenData.refresh_token,
            updated_at: new Date().toISOString()
        },
    };

    let result;
    if (existing) {
        console.log('[DEBUG] Updating existing Chatwork integration:', existing.id);
        result = await supabase
            .from('messaging_integrations')
            .update(payload)
            .eq('id', existing.id);
    } else {
        console.log('[DEBUG] Inserting new Chatwork integration');
        result = await supabase
            .from('messaging_integrations')
            .insert(payload);
    }

    if (result.error) {
        const method = existing ? 'update' : 'insert';
        console.error(`[DEBUG] Chatwork ${method} error:`, result.error);
        return NextResponse.redirect(`${siteUrl}/settings?chatwork=error&reason=db_error_${method}_${result.error.code || 'unknown'}`);
    }

    // rooms を base64 でエンコードして設定画面に渡す
    const roomsBase64 = Buffer.from(JSON.stringify(groupRooms)).toString('base64url');
    return NextResponse.redirect(`${siteUrl}/settings?chatwork=select_room&rooms=${roomsBase64}&v=2`);
}
