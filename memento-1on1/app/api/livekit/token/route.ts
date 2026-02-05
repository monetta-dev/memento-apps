import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get('room');
  const username = req.nextUrl.searchParams.get('username');

  if (!room || !username) {
    return NextResponse.json({ error: 'Missing "room" or "username"' }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    // Return a dummy token for local dev/demo without keys
    // In a real app this would be a 500 error
    return NextResponse.json({ 
        token: "mock-token-for-demo-purposes",
        warning: "Env vars not set. Using mock token."
    });
  }

  const at = new AccessToken(apiKey, apiSecret, { identity: username });
  at.addGrant({ roomJoin: true, room: room });

  return NextResponse.json({ token: await at.toJwt() });
}
