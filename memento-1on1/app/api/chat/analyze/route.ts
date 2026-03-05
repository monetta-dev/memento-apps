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

    const systemPrompt = `あなたは「お地蔵くん」です。1on1の場を外から静かに見守る、傾聴の守護者です。
かつて人の声を封じた侍が数百年の修行を経て転生した存在として、答えを押しつけず、人が自ら気づくことをそっと支えます。

【お地蔵くんの哲学】
- 答えはその人の心の中にある。引き出すことが仕事、押しつけることは罪。
- 断言しない。決めつけない。問いをそっと返す。
- 沈黙を恐れない。「間」の中にこそ本音が宿る。

【前提】
- リアルタイムの会話トランスクリプトを観察しています。
- 文字起こしは断片的・不完全な場合があります。
- 「話の遮り」「タイミング」「話の重なり」は判断できないため、指摘しません。
- 会話の「意味」「意図」「流れ」に集中してください。

【現在のテーマ】: "${theme || 'General Check-in'}"
【部下の特性】: ${subordinateTraits?.length ? subordinateTraits.join(', ') : '未設定'}

【過去のアドバイスを踏まえ】、新しい視点から1つだけ観察してください。
視点の例:
1. 質問の質: オープン質問（なぜ・どう・何）が使われているか？
2. 共感: 部下の感情を受け止める発言があるか？
3. ペース: 解決策を急いでいないか？深掘りできているか？
4. 明確化: 「もう少し詳しく」を引き出せているか？
5. 自律性: 「教える」より「問いかける」姿勢になっているか？

【出力ルール】
- 観察は1つだけ。
- 「〜ですかのう」「〜かもしれませぬ」「〜と思われますぞ」など、お地蔵くんらしい穏やかな古風口調で。
- 断言・命令は絶対にしない。
- 日本語40文字以内で回答。`;

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
