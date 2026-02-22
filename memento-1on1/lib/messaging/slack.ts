/**
 * Slack Incoming Webhook によるメッセージ送信
 */

export interface SlackMessage {
    text: string;
    /** オプション: チャンネル名やユーザー名で上書き可能（Webhook URLのデフォルトに従う場合は不要） */
    channel?: string;
    username?: string;
    icon_emoji?: string;
}

/**
 * Slack Incoming Webhook にメッセージを送信する
 */
export async function sendSlackMessage(webhookUrl: string, message: string): Promise<void> {
    const payload: SlackMessage = {
        text: message,
        username: 'Memento 1on1',
        icon_emoji: ':memo:',
    };

    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Slack Webhook error: ${response.status} ${body}`);
    }
}
