/**
 * Chatwork REST API によるメッセージ送信
 * APIトークン認証（ユーザーが設定画面でコピーして貼り付ける）
 */

const CHATWORK_API_BASE = 'https://api.chatwork.com/v2';

/**
 * Chatwork の指定ルームにメッセージを送信する
 */
export async function sendChatworkMessage(
    apiToken: string,
    roomId: string,
    message: string
): Promise<void> {
    // OAuthアクセストークン（通常は非常に長い）か従来のAPIトークンかを判別
    // OAuthトークンは Authorization: Bearer ヘッダーが必要
    // 従来のAPIトークンは X-ChatWorkToken ヘッダーが必要

    const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (apiToken.length > 64) {
        // OAuthアクセストークンとみなす
        headers['Authorization'] = `Bearer ${apiToken}`;
    } else {
        // 従来のAPIトークンとみなす
        headers['X-ChatWorkToken'] = apiToken;
    }

    const response = await fetch(`${CHATWORK_API_BASE}/rooms/${roomId}/messages`, {
        method: 'POST',
        headers,
        body: new URLSearchParams({ body: message }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Chatwork API error: ${response.status} ${body}`);
    }
}
