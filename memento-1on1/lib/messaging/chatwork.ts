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
        // 401 の場合は呼び出し元で検知できるようにする
        const error = new Error(`Chatwork API error: ${response.status} ${body}`);
        (error as any).status = response.status;
        throw error;
    }
}

/**
 * Chatwork のアクセストークンをリフレッシュする
 */
export async function refreshChatworkToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
    const clientId = process.env.CHATWORK_CLIENT_ID;
    const clientSecret = process.env.CHATWORK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('Chatwork Client configuration is missing');
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://oauth.chatwork.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`,
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Chatwork token refresh failed: ${data.error_description || data.error}`);
    }

    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
    };
}
