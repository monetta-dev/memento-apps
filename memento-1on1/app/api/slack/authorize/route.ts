import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { createRouteHandlerClient } from '@/lib/supabase';

/**
 * state パラメータにユーザーIDとCSRFトークンをHMAC署名付きで埋め込む。
 * Cookieに頼らないため、ngrok等のクロスドメイン環境でも動作する。
 */
function buildState(userId: string, csrf: string): string {
    const payload = `${csrf}:${userId}`;
    const sig = crypto
        .createHmac('sha256', process.env.SLACK_CLIENT_SECRET!)
        .update(payload)
        .digest('hex');
    return Buffer.from(JSON.stringify({ csrf, userId, sig })).toString('base64url');
}

export async function GET(req: NextRequest) {
    const clientId = process.env.SLACK_CLIENT_ID;
    if (!clientId) {
        return NextResponse.json({ error: 'SLACK_CLIENT_ID が設定されていません' }, { status: 500 });
    }

    const cookieStore = await cookies();

    // ログイン中のユーザーIDを取得
    const supabase = createRouteHandlerClient({
        getAll: () => cookieStore.getAll().map(c => ({ name: c.name, value: c.value })),
        setAll: (cs) => cs.forEach(c => cookieStore.set(c.name, c.value, c.options)),
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        return NextResponse.redirect(`${appUrl}/login?error=not_authenticated`);
    }

    // CSRF + ユーザーID を state に署名して埋め込む（Cookie不要）
    const csrf = crypto.randomBytes(16).toString('hex');
    const state = buildState(user.id, csrf);

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/slack/callback`;
    const scope = 'incoming-webhook';

    const params = new URLSearchParams({ client_id: clientId, scope, redirect_uri: redirectUri, state });
    return NextResponse.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
}
