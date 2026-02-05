import { NextRequest, NextResponse } from 'next/server';




export async function POST(req: NextRequest) {
  try {
    // 簡易的な認証チェック

    // 実際にはセッションCookieをチェックする必要がありますが、モック実装ではスキップ

    const { event, sessionId } = await req.json();

    if (!event || !sessionId) {
      return NextResponse.json({ error: 'イベントデータとセッションIDが必要です' }, { status: 400 });
    }

    // モック実装: 実際のGoogle Calendar API呼び出しは後で実装
    console.log('Mock Google Calendar event creation:', {
      summary: event.summary,
      startTime: event.startTime,
      endTime: event.endTime,
      sessionId
    });

    // モックレスポンス
    return NextResponse.json({
      success: true,
      message: 'Googleカレンダーにイベントを作成しました（モック実装）',
      eventId: `mock-event-${Date.now()}`,
      htmlLink: 'https://calendar.google.com/calendar/event?mock=true',
      startTime: event.startTime,
      endTime: event.endTime,
      isMock: true
    });

  } catch (error: unknown) {
    console.error('Google Calendar scheduling error:', error);
    return NextResponse.json({ 
      error: 'Googleカレンダーイベントの作成に失敗しました',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}