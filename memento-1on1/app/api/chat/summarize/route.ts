import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const { transcript, theme } = await req.json();

    if (!transcript || !Array.isArray(transcript)) {
      return NextResponse.json({ error: 'No valid transcript provided' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

    if (!genAI) {
      return NextResponse.json({
        summary: "Mock Summary: Please set GEMINI_API_KEY to get real AI summaries.",
        actionItems: ["Mock Action Item 1", "Mock Action Item 2"]
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conversationLog = transcript.map((t: any) => `${t.speaker}: ${t.text}`).join('\n');

    const prompt = `
You are an expert secretary for engineering managers.
Analyze the following 1on1 meeting transcript thoroughly and generate a detailed report in Japanese.
Theme: "${theme}"

Output valid JSON format with exactly two fields:

1. "summary": A **detailed, structured Markdown report** in Japanese covering ALL of the following sections:

## 📋 セッション概要
（会話全体の目的・背景・流れを2〜3文で説明）

## 💬 主なトピックと議論内容
（話し合われた主要テーマを箇条書きで詳しく。各トピックにサブポイントを含める）

## 🎭 会話のトーンと関係性
（マネージャーと部下のやり取りの雰囲気、感情面の観察、関係性の特徴を記述）

## 💡 重要な気づきと示唆
（この1on1で浮かび上がった課題・改善点・ポジティブな点など）

## 🔮 今後への示唆
（次回の1on1や日常業務で意識すべきことを提言）

2. "actionItems": An array of strings in Japanese, each being a specific, actionable task or follow-up with clear owner/deadline context where possible.

Transcript:
${conversationLog}
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonString = response.text();

    const parsedResult = JSON.parse(jsonString);

    return NextResponse.json(parsedResult);

  } catch (error) {
    console.error("Gemini Summary Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
