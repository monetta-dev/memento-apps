import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(req: NextRequest) {
  try {
    const { transcript, theme, subordinateTraits, question } = await req.json();

    if (!transcript || !Array.isArray(transcript)) {
       return NextResponse.json({ error: 'No valid transcript provided' }, { status: 400 });
    }

    if (!question || typeof question !== 'string') {
       return NextResponse.json({ error: 'No valid question provided' }, { status: 400 });
    }

    if (!genAI) {
        console.warn("Gemini API Key missing. Returning mock answer.");
        const mockAnswer = "This is a mock answer because GEMINI_API_KEY is not set. Please set the environment variable to get real AI responses.";
        return NextResponse.json({ answer: mockAnswer, status: "success" });
    }

    // Construct context
    const systemPrompt = `
あなたは1on1エグゼクティブコーチです。
あなたの目標は、マネージャー（ユーザー）の質問に答えることで、効果的な1on1ミーティングを支援することです。

現在の1on1テーマ: "${theme || 'General Check-in'}"
部下の特徴: ${subordinateTraits ? subordinateTraits.join(', ') : 'Unknown'}

以下の会話トランスクリプトを分析し、マネージャーの質問に答えてください。

質問の種類に応じて、以下のように回答してください：

1. **事実確認の質問**（例：「今回の会議のテーマは？」「部下は何と言いましたか？」）:
   - トランスクリプトから関連情報を抽出し、簡潔に事実を答えます。
   - テーマが指定されている場合は、それを伝えます。

2. **解釈や分析の質問**（例：「部下の気持ちはどうですか？」「この会話のポイントは？」）:
   - トランスクリプトに基づいて観察を共有し、解釈を提供します。

3. **アドバイス要請の質問**（例：「どうすればもっと良い聞き手になれますか？」「次に何をすべきですか？」）:
   - 実用的で実行可能なアドバイスを提供します。

ガイドライン：
- 回答は簡潔に（可能なら200文字以内）
- 日本語でのみ回答
- 回答テキストのみを出力（余分な説明は不要）
- トランスクリプトの文脈を考慮
`;

    // Convert transcript objects to string format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conversationLog = transcript.map((t: any) => `${t.speaker}: ${t.text}`).join('\n');

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent([
        systemPrompt, 
        `Here is the recent transcript:\n${conversationLog}\n\nManager's Question: ${question}\n\nProvide your answer:`
    ]);
    
    const response = await result.response;
    const answer = response.text();

    return NextResponse.json({ 
        answer: answer.trim(),
        status: "success"
    });

  } catch (error) {
    console.error("Gemini Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}