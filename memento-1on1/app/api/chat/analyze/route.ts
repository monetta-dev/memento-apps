import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

type ChatHistoryEntry = {
  role: 'user' | 'model';
  parts: { text: string }[];
};

export async function POST(req: NextRequest) {
  try {
    const { transcript, theme, subordinateTraits, chatHistory } = await req.json();

    if (!transcript || !Array.isArray(transcript)) {
      return NextResponse.json({ error: 'No valid transcript provided' }, { status: 400 });
    }

    if (!genAI) {
      console.warn("Gemini API Key missing. Returning mock advice.");
      const mockAdvice = "The subordinate seems hesitant. (Mock Advice: Set GEMINI_API_KEY)";
      return NextResponse.json({ advice: mockAdvice, status: "success", updatedChatHistory: chatHistory || [] });
    }

    const systemPrompt = `あなたは1on1ミーティングの専門エグゼクティブコーチです。
マネージャーがリーダーシップとコミュニケーションスキルをリアルタイムで向上できるよう支援します。

【前提】
- リアルタイムの会話トランスクリプトを分析しています。
- 文字起こしは断片的・不完全な場合があります。
- 「話の遮り」「タイミング」「話の重なり」は文字起こしでは判断できないため、指摘しないでください。
- 会話の「意味」「意図」「流れ」に集中してください。

【現在のテーマ】: "${theme || 'General Check-in'}"
【部下の特性】: ${subordinateTraits?.length ? subordinateTraits.join(', ') : '未設定'}

【過去のアドバイス内容を踏まえて】、同じことを繰り返さず、新しい視点から1つだけアドバイスしてください。
視点の例:
1. 質問の質: オープン質問（なぜ・どう・何）を使っているか？
2. 共感: 感情を受け止めているか？（例:「それは大変でしたね」）
3. ペース: 解決策を急いでいないか？問題を深掘りできているか？
4. 明確化: 「もう少し詳しく教えて」「それはどういう意味ですか？」を促せるか？
5. 自律性: 「教える」より「問いかける」になっているか？

【出力ルール】
- アドバイスは1つだけ。
- できるだけ今すぐ使えるセリフを提案してください。
- 80文字以内。
- 日本語のみで回答。`;

    const conversationLog = transcript
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((t: any) => `${t.speaker}: ${t.text}`)
      .join('\n');

    const userMessage = `最新の会話トランスクリプト:\n${conversationLog}\n\nリアルタイムアドバイスをお願いします。`;

    // Build chat history from previous turns, prepending the system prompt to the first user message
    const history: ChatHistoryEntry[] = (chatHistory || []).map((entry: ChatHistoryEntry, index: number) => {
      if (index === 0 && entry.role === 'user') {
        return {
          role: 'user' as const,
          parts: [{ text: `${systemPrompt}\n\n${entry.parts[0].text}` }]
        };
      }
      return entry;
    });

    // If no history yet, the system prompt goes into the current message
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    let advice: string;
    let updatedChatHistory: ChatHistoryEntry[];

    if (history.length === 0) {
      // First turn: include system prompt in the message
      const chat = model.startChat({ history: [] });
      const result = await chat.sendMessage(`${systemPrompt}\n\n${userMessage}`);
      advice = result.response.text().trim();

      updatedChatHistory = [
        { role: 'user', parts: [{ text: userMessage }] },
        { role: 'model', parts: [{ text: advice }] }
      ];
    } else {
      // Subsequent turns: history already has context, just send the new message
      const chat = model.startChat({ history });
      const result = await chat.sendMessage(userMessage);
      advice = result.response.text().trim();

      updatedChatHistory = [
        ...chatHistory,
        { role: 'user', parts: [{ text: userMessage }] },
        { role: 'model', parts: [{ text: advice }] }
      ];
    }

    return NextResponse.json({
      advice,
      status: "success",
      updatedChatHistory
    });

  } catch (error) {
    console.error("Gemini Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
