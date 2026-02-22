import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { createRouteHandlerClient } from '@/lib/supabase';

/**
 * HMAC署名付き state を生成（Cookieいらず・クロスドメイン対応）
 */
function buildState(userId: string, csrf: string): string {
    const payload = `${csrf}:${userId}`;
    const sig = crypto
        .createHmac('sha256', process.env.CHATWORK_CLIENT_SECRET!)
        .update(payload)
        .digest('hex');
    return Buffer.from(JSON.stringify({ csrf, userId, sig })).toString('base64url');
}

export async function GET(req: NextRequest) {
    const clientId = process.env.CHATWORK_CLIENT_ID;
    if (!clientId) {
        return NextResponse.json({ error: 'CHATWORK_CLIENT_ID が設定されていません' }, { status: 500 });
    }

    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({
        getAll: () => cookieStore.getAll().map(c => ({ name: c.name, value: c.value })),
        setAll: (cs) => cs.forEach(c => cookieStore.set(c.name, c.value, c.options)),
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        return NextResponse.redirect(`${appUrl}/login?error=not_authenticated`);
    }

    const csrf = crypto.randomBytes(16).toString('hex');
    const state = buildState(user.id, csrf);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const redirectUri = `${appUrl}/api/chatwork/callback`;
    const scope = 'rooms.all:read_write';

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope,
        state,
    });

    return NextResponse.redirect(
        `https://www.chatwork.com/packages/oauth2/login.php?${params.toString()}`
    );
}
