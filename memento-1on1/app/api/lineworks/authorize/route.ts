import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createRouteHandlerClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

/**
 * LINE Works OAuth 認可開始
 * GET /api/lineworks/authorize
 */
export async function GET(req: NextRequest) {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({
        getAll: () => cookieStore.getAll().map(c => ({ name: c.name, value: c.value })),
        setAll: (cs) => cs.forEach(c => cookieStore.set(c.name, c.value, c.options)),
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = process.env.LINEWORKS_CLIENT_ID;
    const clientSecret = process.env.LINEWORKS_CLIENT_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${appUrl}/api/lineworks/callback`;

    if (!clientId || !clientSecret) {
        console.error('Missing LINEWORKS_CLIENT_ID or LINEWORKS_CLIENT_SECRET');
        return NextResponse.json({ error: 'LINE Works configuration missing' }, { status: 500 });
    }

    // CSRF対策とユーザーIDの保持のために state を生成
    const csrfToken = crypto.randomBytes(16).toString('hex');
    const payload = `${csrfToken}:${user.id}`;
    const sig = crypto
        .createHmac('sha256', clientSecret)
        .update(payload)
        .digest('hex');

    const state = Buffer.from(JSON.stringify({ csrf: csrfToken, userId: user.id, sig })).toString('base64url');

    // LINE Works 認可URLへリダイレクト
    // scope は bot を含める
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'bot user.read',
        response_type: 'code',
        state: state,
    });

    return NextResponse.redirect(`https://auth.worksmobile.com/oauth2/v2.0/authorize?${params.toString()}`);
}
