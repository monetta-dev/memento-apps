import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

/**
 * Chatwork の送信先ルームを選択・保存するエンドポイント
 * POST { roomId: number, roomName: string }
 */
export async function POST(req: NextRequest) {
    const { roomId, roomName } = await req.json();
    if (!roomId) {
        return NextResponse.json({ error: 'roomId が必要です' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({
        getAll: () => cookieStore.getAll().map(c => ({ name: c.name, value: c.value })),
        setAll: (cs) => cs.forEach(c => cookieStore.set(c.name, c.value, c.options)),
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
    }

    const { error } = await supabase
        .from('messaging_integrations')
        .update({
            room_id: String(roomId),
            display_name: `Chatwork #${roomName}`,
            enabled: true,
        })
        .eq('user_id', user.id)
        .eq('provider', 'chatwork');

    if (error) {
        console.error('Failed to save Chatwork room:', error);
        return NextResponse.json({ error: 'ルームの保存に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
