import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@/lib/supabase';
import { sendSlackMessage } from '@/lib/messaging/slack';
import { sendChatworkMessage } from '@/lib/messaging/chatwork';
import { sendLineWorksMessage } from '@/lib/messaging/lineworks';

export type MessagingProvider = 'slack' | 'chatwork' | 'lineworks';

export async function POST(req: NextRequest) {
    try {
        const { userId, provider, message, sessionId } = await req.json() as {
            userId: string;
            provider: MessagingProvider;
            message: string;
            sessionId?: string;
        };

        if (!userId || !provider || !message) {
            return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const supabase = createRouteHandlerClient({
            getAll: () => cookieStore.getAll().map(c => ({ name: c.name, value: c.value })),
            setAll: (cookies) => cookies.forEach(c => cookieStore.set(c.name, c.value, c.options)),
        });

        // 連携設定を取得
        const { data: integration, error } = await supabase
            .from('messaging_integrations')
            .select('*')
            .eq('user_id', userId)
            .eq('provider', provider)
            .eq('enabled', true)
            .single();

        if (error || !integration) {
            return NextResponse.json({
                error: `${provider} 連携が設定されていません`,
            }, { status: 400 });
        }

        // プロバイダーごとに送信
        switch (provider) {
            case 'slack':
                if (!integration.webhook_url) {
                    return NextResponse.json({ error: 'Slack Webhook URLが設定されていません' }, { status: 400 });
                }
                await sendSlackMessage(integration.webhook_url, message);
                break;

            case 'chatwork':
                if (!integration.api_token || !integration.room_id) {
                    return NextResponse.json({ error: 'Chatwork APIトークンまたはルームIDが設定されていません' }, { status: 400 });
                }
                await sendChatworkMessage(integration.api_token, integration.room_id, message);
                break;

            case 'lineworks':
                if (!integration.api_token || !integration.room_id) {
                    return NextResponse.json({ error: 'LINE Works 設定が不足しています' }, { status: 400 });
                }
                await sendLineWorksMessage(integration.api_token, integration.room_id, message);
                break;

            default:
                return NextResponse.json({ error: '不明なプロバイダーです' }, { status: 400 });
        }

        // 送信ログを記録
        await supabase.from('notification_logs').insert({
            user_id: userId,
            session_id: sessionId || null,
            notification_type: 'summary',
            message,
            status: 'sent',
            sent_at: new Date().toISOString(),
        });

        return NextResponse.json({ success: true, provider, sentAt: new Date().toISOString() });

    } catch (error) {
        console.error('Messaging send error:', error);
        return NextResponse.json({
            error: 'メッセージ送信に失敗しました',
            details: error instanceof Error ? error.message : String(error),
        }, { status: 500 });
    }
}
