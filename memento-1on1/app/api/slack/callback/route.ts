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
 * state を検証してユーザーIDを取り出す。
 * 改ざん検知（HMAC署名チェック）付き。
 */
function parseAndVerifyState(state: string): { userId: string; csrf: string } | null {
    try {
        const { csrf, userId, sig } = JSON.parse(Buffer.from(state, 'base64url').toString()) as {
            csrf: string; userId: string; sig: string;
        };
        const payload = `${csrf}:${userId}`;
        const expectedSig = crypto
            .createHmac('sha256', process.env.SLACK_CLIENT_SECRET!)
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';  // OAuth callback URI用
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || appUrl;                   // ユーザーへのリダイレクト用

    if (error === 'access_denied') {
        return NextResponse.redirect(`${siteUrl}/settings?slack=cancelled`);
    }

    if (!code || !state) {
        return NextResponse.redirect(`${siteUrl}/settings?slack=error&reason=missing_params`);
    }

    // state を検証してユーザーIDを取得（Cookieいらず）
    const verified = parseAndVerifyState(state);
    if (!verified) {
        return NextResponse.redirect(`${siteUrl}/settings?slack=error&reason=invalid_state`);
    }
    const { userId } = verified;

    // コードをトークンと交換
    const clientId = process.env.SLACK_CLIENT_ID!;
    const clientSecret = process.env.SLACK_CLIENT_SECRET!;
    const redirectUri = `${appUrl}/api/slack/callback`;

    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.ok) {
        console.error('Slack token exchange failed:', tokenData.error);
        return NextResponse.redirect(`${siteUrl}/settings?slack=error&reason=${tokenData.error}`);
    }

    const webhookUrl = tokenData.incoming_webhook?.url as string | undefined;
    const channelName = tokenData.incoming_webhook?.channel as string | undefined;
    const teamName = tokenData.team?.name as string | undefined;

    if (!webhookUrl) {
        return NextResponse.redirect(`${siteUrl}/settings?slack=error&reason=no_webhook`);
    }

    console.log(`[DEBUG] Slack callback started for user: ${userId}`);

    // Service Role クライアントでDBに保存
    const supabase = createServiceRoleClient();

    // 手動 upsert: まず存在確認
    const { data: existing, error: selectError } = await supabase
        .from('messaging_integrations')
        .select('id')
        .eq('user_id', userId)
        .eq('provider', 'slack')
        .maybeSingle();

    if (selectError) {
        console.error('[DEBUG] Slack select error:', selectError);
        return NextResponse.redirect(`${siteUrl}/settings?slack=error&reason=db_error_select_${selectError.code || 'unknown'}`);
    }

    const payload = {
        user_id: userId,
        provider: 'slack',
        webhook_url: webhookUrl,
        api_token: null,
        room_id: null,
        display_name: `${teamName ?? 'Slack'} ${channelName ? `#${channelName}` : ''}`.trim(),
        enabled: true,
        metadata: {
            team_name: teamName,
            channel_name: channelName,
            access_token: tokenData.access_token,
            updated_at: new Date().toISOString()
        },
    };

    let result;
    if (existing) {
        console.log('[DEBUG] Updating existing Slack integration:', existing.id);
        result = await supabase
            .from('messaging_integrations')
            .update(payload)
            .eq('id', existing.id);
    } else {
        console.log('[DEBUG] Inserting new Slack integration');
        result = await supabase
            .from('messaging_integrations')
            .insert(payload);
    }

    if (result.error) {
        const method = existing ? 'update' : 'insert';
        console.error(`[DEBUG] Slack ${method} error:`, result.error);
        return NextResponse.redirect(`${siteUrl}/settings?slack=error&reason=db_error_${method}_${result.error.code || 'unknown'}`);
    }

    return NextResponse.redirect(
        `${siteUrl}/settings?slack=connected&channel=${encodeURIComponent(channelName ?? '')}&v=2`
    );
}
