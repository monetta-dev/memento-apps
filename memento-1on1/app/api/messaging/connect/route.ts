import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    try {
        const { userId, provider, webhookUrl, apiToken, roomId, displayName } = await req.json() as {
            userId: string;
            provider: 'slack' | 'chatwork' | 'lineworks';
            webhookUrl?: string;
            apiToken?: string;
            roomId?: string;
            displayName?: string;
        };

        if (!userId || !provider) {
            return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const supabase = createRouteHandlerClient({
            getAll: () => cookieStore.getAll().map(c => ({ name: c.name, value: c.value })),
            setAll: (cookies) => cookies.forEach(c => cookieStore.set(c.name, c.value, c.options)),
        });

        // upsert（既存があれば更新、なければ挿入）
        const { data, error } = await supabase
            .from('messaging_integrations')
            .upsert({
                user_id: userId,
                provider,
                webhook_url: webhookUrl || null,
                api_token: apiToken || null,
                room_id: roomId || null,
                display_name: displayName || provider,
                enabled: true,
            }, {
                onConflict: 'user_id,provider',
            })
            .select()
            .single();

        if (error) {
            console.error('Failed to save messaging integration:', error);
            return NextResponse.json({ error: '連携設定の保存に失敗しました', details: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, integration: data });

    } catch (error) {
        console.error('Messaging connect error:', error);
        return NextResponse.json({
            error: '連携設定に失敗しました',
            details: error instanceof Error ? error.message : String(error),
        }, { status: 500 });
    }
}
