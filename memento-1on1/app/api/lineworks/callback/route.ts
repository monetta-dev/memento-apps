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

/**
 * state を検証してユーザーIDを取り出す
 */
function parseAndVerifyState(state: string): { userId: string; csrf: string } | null {
    try {
        const { csrf, userId, sig } = JSON.parse(Buffer.from(state, 'base64url').toString()) as {
            csrf: string; userId: string; sig: string;
        };
        const payload = `${csrf}:${userId}`;
        const expectedSig = crypto
            .createHmac('sha256', process.env.LINEWORKS_CLIENT_SECRET!)
            .update(payload)
            .digest('hex');
        if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
            return null;
        }
        return { userId, csrf };
    } catch {
        return null;
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || appUrl;

    if (error === 'access_denied') {
        return NextResponse.redirect(`${siteUrl}/settings?lineworks=cancelled`);
    }

    if (!code || !state) {
        return NextResponse.redirect(`${siteUrl}/settings?lineworks=error&reason=missing_params`);
    }

    const verified = parseAndVerifyState(state);
    if (!verified) {
        return NextResponse.redirect(`${siteUrl}/settings?lineworks=error&reason=invalid_state`);
    }
    const { userId } = verified;

    // トークン交換
    const clientId = process.env.LINEWORKS_CLIENT_ID!;
    const clientSecret = process.env.LINEWORKS_CLIENT_SECRET!;
    const redirectUri = `${appUrl}/api/lineworks/callback`;

    const tokenRes = await fetch('https://auth.worksmobile.com/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri
        }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
        console.error('LINE Works token exchange failed:', tokenData);
        return NextResponse.redirect(`${siteUrl}/settings?lineworks=error&reason=${tokenData.error || 'token_exchange_failed'}`);
    }

    const accessToken = (tokenData.access_token as string).trim();

    // ユーザー情報の取得
    const userRes = await fetch('https://www.worksapis.com/v1.0/users/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const userData = await userRes.json();

    if (!userRes.ok) {
        console.error('LINE Works user info fetch failed:', userData);
        return NextResponse.redirect(`${siteUrl}/settings?lineworks=error&reason=user_info_failed`);
    }

    const lineWorksUserId = userData.userId; // UUID形式の Internal ID
    const lineWorksUserName = userData.userName || userData.name || 'LINE Works User';

    // LINE Works は Bot ID が必要。管理者が設定したものを環境変数またはメタデータで持つ。
    const supabase = createServiceRoleClient();

    // 手動 upsert
    const { data: existing, error: selectError } = await supabase
        .from('messaging_integrations')
        .select('id')
        .eq('user_id', userId)
        .eq('provider', 'lineworks')
        .maybeSingle();

    if (selectError) {
        console.error('LINE Works select error:', selectError);
        return NextResponse.redirect(`${siteUrl}/settings?lineworks=error&reason=db_error_select`);
    }

    const payload = {
        user_id: userId,
        provider: 'lineworks',
        api_token: tokenData.access_token,
        webhook_url: null,
        room_id: lineWorksUserId, // メッセージ送信先として自身の userId を保存
        display_name: `LINE Works (${lineWorksUserName})`,
        enabled: true,
        metadata: {
            refresh_token: tokenData.refresh_token,
            scope: tokenData.scope,
            updated_at: new Date().toISOString()
        },
    };

    let result;
    if (existing) {
        result = await supabase
            .from('messaging_integrations')
            .update(payload)
            .eq('id', existing.id);
    } else {
        result = await supabase
            .from('messaging_integrations')
            .insert(payload);
    }

    if (result.error) {
        console.error('Failed to save LINE Works integration:', result.error);
        return NextResponse.redirect(`${siteUrl}/settings?lineworks=error&reason=db_error_${existing ? 'update' : 'insert'}`);
    }

    return NextResponse.redirect(`${siteUrl}/settings?lineworks=connected&v=1`);
}
