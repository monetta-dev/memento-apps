import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(req: NextRequest) {
  try {
    if (!genAI) {
      return NextResponse.json({ 
        error: 'Gemini API Key not configured',
        traits: ['Analytical', 'Communicative'] // Mock fallback
      }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _subordinateId = formData.get('subordinateId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    // Convert file to base64
    const buffer = await file.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString('base64');

    // Use Gemini Vision to analyze PDF
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const prompt = `
You are an expert HR analyst. Analyze this PDF document which contains employee evaluation or personality assessment results.
Extract key personality traits, strengths, weaknesses, and behavioral patterns from the document.
Return ONLY a JSON array of strings representing the extracted traits.
Example: ["Analytical", "Detail-oriented", "Collaborative", "Reserved", "Strategic thinker"]
Focus on traits relevant to 1on1 coaching and management.
`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Data
        }
      }
    ]);

    const response = await result.response;
    const text = response.text().trim();

    // Parse the response (expecting JSON array)
    let traits: string[] = [];
    try {
      // Try to parse as JSON
      traits = JSON.parse(text);
      if (!Array.isArray(traits)) {
        traits = text.split(',').map(t => t.trim()).filter(t => t.length > 0);
      }
    } catch {
      // Fallback: split by lines or commas
      traits = text.split(/[\n,]/).map(t => t.trim().replace(/["\[\]]/g, '')).filter(t => t.length > 0);
    }

    // Limit to reasonable number
    traits = traits.slice(0, 10);

    return NextResponse.json({ 
      success: true,
      traits,
      originalText: text.substring(0, 500) // For debugging
    });

  } catch (error) {
    console.error("PDF Analysis Error:", error);
    return NextResponse.json({ 
      error: 'Failed to analyze PDF',
      traits: ['Analytical', 'Communicative'] // Mock fallback
    }, { status: 500 });
  }
}