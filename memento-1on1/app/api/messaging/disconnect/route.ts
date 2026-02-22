import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    try {
        const { userId, provider } = await req.json() as {
            userId: string;
            provider: 'slack' | 'chatwork' | 'lineworks';
        };

        if (!userId || !provider) {
            return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const supabase = createRouteHandlerClient({
            getAll: () => cookieStore.getAll().map(c => ({ name: c.name, value: c.value })),
            setAll: (cookies) => cookies.forEach(c => cookieStore.set(c.name, c.value, c.options)),
        });

        const { error } = await supabase
            .from('messaging_integrations')
            .update({ enabled: false })
            .eq('user_id', userId)
            .eq('provider', provider);

        if (error) {
            return NextResponse.json({ error: '連携解除に失敗しました', details: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json({
            error: '連携解除に失敗しました',
            details: error instanceof Error ? error.message : String(error),
        }, { status: 500 });
    }
}
