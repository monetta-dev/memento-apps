import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    if (!supabase) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Supabase client not initialized',
          message: 'Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables'
        },
        { status: 500 }
      );
    }

    // Test connection by fetching current user (anon)
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('Supabase auth test error:', userError);
    }

    // Test basic query to check if tables exist
    const { data: tablesData, error: tablesError } = await supabase
      .from('subordinates')
      .select('count', { count: 'exact', head: true })
      .limit(1);

    const { data: sessionsData, error: sessionsError } = await supabase
      .from('sessions')
      .select('count', { count: 'exact', head: true })
      .limit(1);

    return NextResponse.json({
      success: true,
      connection: 'connected',
      auth: {
        hasUser: !!userData?.user,
        error: userError?.message || null
      },
      tables: {
        subordinates: {
          exists: !tablesError,
          error: tablesError?.message || null,
          count: tablesData?.length || 0
        },
        sessions: {
          exists: !sessionsError,
          error: sessionsError?.message || null,
          count: sessionsData?.length || 0
        }
      },
       env: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'not set',
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'set' : 'not set',
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL ? 'set' : 'not set',
        livekitUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL ? 'set' : 'not set',
        livekitKey: process.env.LIVEKIT_API_KEY ? 'set' : 'not set',
        geminiKey: process.env.GEMINI_API_KEY ? 'set' : 'not set',
        deepgramKey: process.env.DEEPGRAM_API_KEY ? 'set' : 'not set',
        lineChannelId: process.env.LINE_LOGIN_CHANNEL_ID ? 'set' : 'not set',
        lineChannelSecret: process.env.LINE_LOGIN_CHANNEL_SECRET ? 'set' : 'not set',
        lineRedirectUri: process.env.LINE_REDIRECT_URI ? 'set' : 'not set'
      },
      oauth: {
        googleRedirectUrl: process.env.NEXT_PUBLIC_SITE_URL ? 
          `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` : 'not set (NEXT_PUBLIC_SITE_URL missing)',
        lineRedirectUrl: process.env.LINE_REDIRECT_URI || 'not set'
      }
    });

  } catch (error) {
    console.error('Supabase test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Unexpected error',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}