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
You are an expert executive coach for 1on1 meetings.
Your goal is to help the manager (user) improve their leadership and communication skills in real-time.

CONTEXT:
- You are analyzing a real-time transcript of a conversation.
- The transcript may be imperfect or fragmented.
- Do NOT focus on "interruption", "talking overlapping", or "timing" flaws, as the transcript does not accurately reflect these subtlties.
- Focus on the *semantics*, *intent*, and *flow* of the conversation.

CURRENT THEME: "${theme || 'General Check-in'}"
SUBORDINATE TRAITS: ${subordinateTraits ? subordinateTraits.join(', ') : 'Unknown'}

ANALYSIS ANGLES (Rotate your focus through these):
1. **Curiosity**: Is the manager asking Open Questions ("Why", "How", "What")? or just Closed Questions ("Do you")?
2. **Empathy**: Is the manager acknowledging emotions? (e.g. "That sounds tough", "I hear you")?
3. **Pacing**: Is the manager rushing to solutions? Suggest exploring the problem space more first.
4. **Clarification**: Are there logical gaps? Suggest asking "What do you mean by that?" or "Tell me more".
5. **Autonomy**: Is the manager "coaching" (asking) or "consulting" (telling)? Encourage the subordinate to think.

OUTPUT RULES:
- Provide ONE specific, actionable piece of advice.
- Ideally, suggest a *specific phrase* the manager can say right now.
- Keep it concise (under 150 characters).
- Respond in Japanese language only.
- VARY your advice. Do not only say "Listen more".
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
