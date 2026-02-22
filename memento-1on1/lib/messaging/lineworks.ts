/**
 * LINE Works Bot API 2.0 によるメッセージ送信
 * 
 * LINE Works の Bot は「Bot ID」を指定して、特定のユーザー（userId）に送信します。
 */
export async function sendLineWorksMessage(
    accessToken: string,
    userId: string, // LINE Works のユーザーID (Internal ID / UUID)
    message: string
): Promise<void> {
    const rawBotId = process.env.LINEWORKS_BOT_ID;
    if (!rawBotId) {
        throw new Error('LINEWORKS_BOT_ID is not configured');
    }

    const botId = rawBotId.trim();
    const cleanUserId = userId.trim();
    const cleanToken = accessToken.trim();

    // LINE Works API 2.0 Messaging Bot エンドポイント (User宛)
    const endpoint = `https://www.worksapis.com/v1.0/bots/${botId}/users/${cleanUserId}/messages`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cleanToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
            },
            body: JSON.stringify({
                content: {
                    type: 'text',
                    text: message,
                }
            }),
        });

        if (!response.ok) {
            const errorHtmlOrJson = await response.text();
            // エラー時、URLを一部マスクして報告（デバッグ用）
            const maskedEndpoint = endpoint.replace(botId, '***').replace(cleanUserId, '***');
            throw new Error(`LINE Works API error (Status: ${response.status}) at ${maskedEndpoint}. Response: ${errorHtmlOrJson.substring(0, 200)}...`);
        }
    } catch (err) {
        console.error('sendLineWorksMessage failed:', err);
        throw err;
    }
}
