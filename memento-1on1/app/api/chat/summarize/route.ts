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
Summarize the following 1on1 meeting transcript in Japanese.
Theme: "${theme}"

Output valid JSON format with two fields:
1. "summary": A concise paragraph summarizing the discussion in Japanese (3-5 sentences).
2. "actionItems": An array of strings in Japanese, listing specific tasks or follow-ups.

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
