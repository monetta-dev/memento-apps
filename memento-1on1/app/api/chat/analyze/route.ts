import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(req: NextRequest) {
  try {
    const { transcript, theme, subordinateTraits } = await req.json();

    if (!transcript || !Array.isArray(transcript)) {
       return NextResponse.json({ error: 'No valid transcript provided' }, { status: 400 });
    }

    if (!genAI) {
        console.warn("Gemini API Key missing. Returning mock advice.");
        const mockAdvice = "The subordinate seems hesitant. (Mock Advice: Set GEMINI_API_KEY)";
        return NextResponse.json({ advice: mockAdvice, status: "success" });
    }

    // Construct context
    const systemPrompt = `
You are an expert 1on1 executive coach.
Your goal is to help the manager (user) improve their listening skills.

Current 1on1 Theme: "${theme || 'General Check-in'}"
Subordinate Traits: ${subordinateTraits ? subordinateTraits.join(', ') : 'Unknown'}

Analyze the recent conversation transcript provided below.
1. Identify if the manager is talking too much.
2. Spot emotional cues from the subordinate that the manager might have missed.
3. Provide one concise, actionable piece of advice for the manager to use IMMEDIATELY.
4. Keep the advice under 100 characters if possible.
5. Output ONLY the advice text, nothing else.
6. Respond in Japanese language only.
`;

    // Convert transcript objects to string format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conversationLog = transcript.map((t: any) => `${t.speaker}: ${t.text}`).join('\n');

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent([
        systemPrompt, 
        `Here is the recent transcript:\n${conversationLog}\n\nProvide your real-time advice:`
    ]);
    
    const response = await result.response;
    const advice = response.text();

    return NextResponse.json({ 
        advice: advice.trim(),
        status: "success"
    });

  } catch (error) {
    console.error("Gemini Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
