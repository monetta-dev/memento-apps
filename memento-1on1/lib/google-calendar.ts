import { createClientComponentClient } from './supabase';

export interface CalendarEvent {
  summary: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendees?: { email: string }[];
}

export async function getGoogleAccessToken(): Promise<string | null> {
  try {
    const supabase = createClientComponentClient();
    const { data: { session } } = await supabase.auth.getSession();

    // 1. セッション(ブラウザメモリ)にある場合はそれを使う (一番速い)
    if (session?.provider_token) {
      return session.provider_token;
    }

    // 2. セッションにない(リロード後など)場合は、API経由でDBから取得(必要ならリフレッシュ)
    console.log('No session token, fetching from server...');
    const response = await fetch('/api/google-calendar/get-token');

    if (response.ok) {
      const data = await response.json();
      if (data.accessToken) {
        return data.accessToken;
      }
    }

    console.warn('No Google OAuth token found in session or database');
    return null;
  } catch (error) {
    console.error('Error getting Google access token:', error);
    return null;
  }
}

export async function createGoogleCalendarEvent(
  event: CalendarEvent,
  calendarId: string = 'primary'
): Promise<unknown> {
  try {
    const accessToken = await getGoogleAccessToken();

    if (!accessToken) {
      throw new Error('No Google access token available. Please sign in with Google.');
    }

    const eventData = {
      summary: event.summary,
      description: event.description || '',
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: 'Asia/Tokyo',
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: 'Asia/Tokyo',
      },
      attendees: event.attendees,
      reminders: {
        useDefault: true,
      },
    };

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Google Calendar API error: ${response.status} ${response.statusText} - ${errorData}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating Google Calendar event:', error);
    throw error;
  }
}

export async function listGoogleCalendarEvents(
  calendarId: string = 'primary',
  timeMin?: Date,
  timeMax?: Date,
  maxResults: number = 10
): Promise<unknown> {
  try {
    const accessToken = await getGoogleAccessToken();

    if (!accessToken) {
      throw new Error('No Google access token available. Please sign in with Google.');
    }

    const params = new URLSearchParams({
      maxResults: maxResults.toString(),
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    if (timeMin) {
      params.append('timeMin', timeMin.toISOString());
    }
    if (timeMax) {
      params.append('timeMax', timeMax.toISOString());
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Google Calendar API error: ${response.status} ${response.statusText} - ${errorData}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error listing Google Calendar events:', error);
    throw error;
  }
}