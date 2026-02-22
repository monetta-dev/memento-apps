import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@/lib/supabase';
import { sendSlackMessage } from '@/lib/messaging/slack';
import { sendChatworkMessage, refreshChatworkToken } from '@/lib/messaging/chatwork';
import { sendLineWorksMessage, refreshLineWorksToken } from '@/lib/messaging/lineworks';

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

        // サービスロールクライアント（トークンの更新保存用）
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );

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

        const sendMessageWithRetry = async (currentApiToken: string) => {
            switch (provider) {
                case 'slack':
                    if (!integration.webhook_url) throw new Error('Slack Webhook URLが設定されていません');
                    await sendSlackMessage(integration.webhook_url, message);
                    break;

                case 'chatwork':
                    if (!currentApiToken || !integration.room_id) throw new Error('Chatwork 設定が不足しています');
                    await sendChatworkMessage(currentApiToken, integration.room_id, message);
                    break;

                case 'lineworks':
                    if (!currentApiToken || !integration.room_id) throw new Error('LINE Works 設定が不足しています');
                    await sendLineWorksMessage(currentApiToken, integration.room_id, message);
                    break;
            }
        };

        try {
            await sendMessageWithRetry(integration.api_token);
        } catch (err: any) {
            // 401 Unauthorized かつ refresh_token がある場合にリフレッシュを試行
            const refreshToken = integration.metadata?.refresh_token;
            if (err.status === 401 && refreshToken) {
                console.log(`[Messaging] Token expired for ${provider}, attempting refresh...`);
                let newToken;
                try {
                    if (provider === 'chatwork') {
                        newToken = await refreshChatworkToken(refreshToken);
                    } else if (provider === 'lineworks') {
                        newToken = await refreshLineWorksToken(refreshToken);
                    }

                    if (newToken) {
                        // DBのトークンを更新
                        await supabaseAdmin.from('messaging_integrations').update({
                            api_token: newToken.access_token,
                            metadata: {
                                ...integration.metadata,
                                refresh_token: newToken.refresh_token,
                                updated_at: new Date().toISOString()
                            }
                        }).eq('id', integration.id);

                        // 新しいトークンでリトライ
                        console.log(`[Messaging] Token refreshed for ${provider}, retrying send...`);
                        await sendMessageWithRetry(newToken.access_token);
                    } else {
                        throw err;
                    }
                } catch (refreshErr) {
                    console.error(`[Messaging] Refresh failed for ${provider}:`, refreshErr);
                    throw err; // 最初のエラーを投げる
                }
            } else {
                throw err;
            }
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
