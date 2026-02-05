import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const deepgramApiKey = process.env.DEEPGRAM_API_KEY?.trim();

  if (!deepgramApiKey) {
    console.warn('DEEPGRAM_API_KEY is not configured or empty');
    return NextResponse.json({ 
      error: 'Deepgram API Key not configured',
      mockMode: true 
    });
  }

  try {
    console.log('Attempting to fetch Deepgram temporary token with API key length:', deepgramApiKey.length);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ttl_seconds: 3600 }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorDetail = '';
      try {
        const errorJson = await response.json();
        errorDetail = JSON.stringify(errorJson);
      } catch {
        errorDetail = await response.text();
      }
      console.error('Deepgram grant API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorDetail,
        apiKeyLength: deepgramApiKey.length,
        apiKeyPrefix: deepgramApiKey.substring(0, 5) + '...'
      });
      throw new Error(`Deepgram API error: ${response.status} ${response.statusText} - ${errorDetail}`);
    }

    const data = await response.json();

    if (!data.access_token) {
      console.error('No access_token in Deepgram response:', data);
      throw new Error('No access_token in Deepgram response');
    }

    console.log('Successfully generated Deepgram token:', {
      keyLength: data.access_token.length,
      keyPrefix: data.access_token.substring(0, 20) + '...',
      expiresIn: data.expires_in,
      ttlRequested: 3600
    });

    return NextResponse.json({
      key: data.access_token,
      expiresIn: data.expires_in,
      mockMode: false
    });

   } catch (err) {
    console.error('Deepgram Token Error:', {
      message: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
      name: err instanceof Error ? err.name : 'Unknown',
      isAbort: err instanceof Error && err.name === 'AbortError'
    });

    const errorMessage = err instanceof Error && err.name === 'AbortError' 
      ? 'Request timeout to Deepgram API'
      : 'Failed to generate temporary token';

    return NextResponse.json({
      error: errorMessage,
      mockMode: true
    }, { status: 500 });
  }
}
