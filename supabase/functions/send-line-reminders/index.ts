// Edge Function to send LINE reminders for upcoming 1on1 sessions
// Runs on a schedule (every 5 minutes) and sends notifications 1 hour before sessions

import { createClient } from 'npm:@supabase/supabase-js@^2.91.0';
import { load } from 'https://deno.land/std@0.224.0/dotenv/mod.ts';

// Load environment variables (for local development)
const env = await load({ allowEmptyValues: true });
const supabaseUrl = Deno.env.get('SUPABASE_URL') || env['SUPABASE_URL'];
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || env['SUPABASE_SERVICE_ROLE_KEY'];
const lineMessagingAccessToken = Deno.env.get('LINE_MESSAGING_ACCESS_TOKEN') || env['LINE_MESSAGING_ACCESS_TOKEN'];

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}
if (!lineMessagingAccessToken) {
  console.warn('LINE_MESSAGING_ACCESS_TOKEN not set, LINE notifications will fail');
}

// Create Supabase client with service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// LINE Messaging API endpoint
const LINE_MESSAGING_API_URL = 'https://api.line.me/v2/bot/message/push';

interface SessionWithNotifications {
  id: string;
  subordinate_id: string;
  user_id: string;
  next_session_date: string;
  next_session_duration_minutes: number;
  line_reminder_scheduled: boolean;
  line_reminder_sent_at: string | null;
  line_notifications: {
    line_user_id: string;
    line_display_name: string | null;
    enabled: boolean;
    notification_types: string[];
  };
  subordinates: {
    name: string;
  };
}

Deno.serve(async (req) => {
  // This function is called on each request
  // We'll use a cron trigger, but also allow manual triggering via HTTP
  const url = new URL(req.url);
  console.log(`Request received: ${req.method} ${url.pathname}`);
  
  // Allow any path for now
  // if (url.pathname !== '/') {
  //   return new Response('Not Found', { status: 404 });
  // }

   // Skip authentication check for testing
   console.log('Skipping authentication check for all requests');
   console.log('Request method:', req.method);
   console.log('Request URL:', req.url);
   console.log('Headers:', Object.fromEntries(req.headers.entries()));

  try {
    console.log('Starting LINE reminder check...');
    
    // Get current time in UTC
    const now = new Date();
    const nowUTC = now.toISOString();
    
    // Calculate time window: sessions starting in the next hour (25-75 minutes from now)
    // This ensures we catch sessions even if the function runs every 5 minutes
    // Wider window to account for cron timing variations and ensure we don't miss sessions
    // Using 25-75 minutes instead of 30-70 to be more inclusive
    const startWindow = new Date(now.getTime() + 25 * 60 * 1000); // 25 minutes from now
    const endWindow = new Date(now.getTime() + 75 * 60 * 1000); // 75 minutes from now
    
    console.log(`=== LINE Reminder Debug ===`);
    console.log(`現在時刻 (UTC): ${nowUTC}`);
    console.log(`現在時刻 (local): ${now.toString()}`);
    console.log(`検索ウィンドウ開始: ${startWindow.toISOString()} (30分後)`);
    console.log(`検索ウィンドウ終了: ${endWindow.toISOString()} (70分後)`);
    console.log(`ウィンドウ幅: ${(endWindow.getTime() - startWindow.getTime()) / (1000 * 60)}分`);
    console.log(`検索条件:`);
    console.log(`  - line_reminder_scheduled = false`);
    console.log(`  - line_reminder_sent_at IS NULL`);
    console.log(`  - next_session_date IS NOT NULL`);
    console.log(`  - user_id IS NOT NULL`);
    console.log(`  - next_session_date BETWEEN ${startWindow.toISOString()} AND ${endWindow.toISOString()}`);
    console.log(`  - subordinates!inner(name) 結合`);
    
    // Query sessions that need LINE reminders
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        id,
        subordinate_id,
        user_id,
        next_session_date,
        next_session_duration_minutes,
        line_reminder_scheduled,
        line_reminder_sent_at,
        subordinates!inner(name)
      `)
      .eq('line_reminder_scheduled', false)
      .is('line_reminder_sent_at', null)
      .not('next_session_date', 'is', null)
      .not('user_id', 'is', null)  // Ensure session has a user_id
      .gte('next_session_date', startWindow.toISOString())
      .lte('next_session_date', endWindow.toISOString());
    
    if (error) {
      console.error('Error querying sessions:', error);
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`Found ${sessions?.length || 0} sessions needing LINE reminders`);
    
    // Debug: Log session details if found
    if (sessions && sessions.length > 0) {
      console.log(`=== Sessions Found ===`);
      sessions.forEach((session, index) => {
        const sessionTime = new Date(session.next_session_date);
        const minutesDiff = (sessionTime.getTime() - now.getTime()) / (1000 * 60);
        console.log(`Session ${index + 1}:`);
        console.log(`  ID: ${session.id}`);
        console.log(`  User ID: ${session.user_id}`);
        console.log(`  Subordinate ID: ${session.subordinate_id}`);
        console.log(`  Next Session Date: ${session.next_session_date}`);
        console.log(`  Local Time: ${sessionTime.toString()}`);
        console.log(`  Minutes from now: ${minutesDiff.toFixed(2)}`);
        console.log(`  Subordinate Name: ${session.subordinates?.name || 'N/A'}`);
        console.log(`  line_reminder_scheduled: ${session.line_reminder_scheduled}`);
        console.log(`  line_reminder_sent_at: ${session.line_reminder_sent_at}`);
        
        // Check if session is within the exact time window
        const isWithinWindow = 
          sessionTime >= startWindow && 
          sessionTime <= endWindow;
        console.log(`  Within time window (30-70 min): ${isWithinWindow}`);
        if (!isWithinWindow) {
          console.log(`  WARNING: Session is outside defined time window!`);
          const startDiff = (startWindow.getTime() - sessionTime.getTime()) / (1000 * 60);
          const endDiff = (endWindow.getTime() - sessionTime.getTime()) / (1000 * 60);
          console.log(`  Start window difference: ${startDiff.toFixed(2)} minutes`);
          console.log(`  End window difference: ${endDiff.toFixed(2)} minutes`);
        }
      });
    } else {
      console.log(`=== No Sessions Found ===`);
      console.log(`Checking if this is a data issue or query issue...`);
      
      // Let's run a broader query to debug
      console.log(`=== Running debug queries ===`);
      
      // Query 1: Check sessions in wider window (0-120 minutes)
      const debugStartWindow = new Date(now.getTime());
      const debugEndWindow = new Date(now.getTime() + 120 * 60 * 1000);
      
      const { data: debugSessions, error: debugError } = await supabase
        .from('sessions')
        .select(`
          id,
          subordinate_id,
          user_id,
          next_session_date,
          line_reminder_scheduled,
          line_reminder_sent_at,
          subordinates!inner(name)
        `)
        .not('next_session_date', 'is', null)
        .gte('next_session_date', debugStartWindow.toISOString())
        .lte('next_session_date', debugEndWindow.toISOString());
      
      if (debugError) {
        console.error('Debug query error:', debugError);
      } else {
        console.log(`Debug: Found ${debugSessions?.length || 0} sessions in next 2 hours:`);
        if (debugSessions && debugSessions.length > 0) {
          debugSessions.forEach((session, index) => {
            const sessionTime = new Date(session.next_session_date);
            const minutesDiff = (sessionTime.getTime() - now.getTime()) / (1000 * 60);
            const inWindow = 
              !session.line_reminder_scheduled && 
              session.line_reminder_sent_at === null &&
              session.user_id !== null &&
              minutesDiff >= 30 && 
              minutesDiff <= 70;
            
            console.log(`  ${index + 1}. ID: ${session.id}`);
            console.log(`     Time: ${session.next_session_date} (${minutesDiff.toFixed(2)} min from now)`);
            console.log(`     User ID: ${session.user_id}`);
            console.log(`     Scheduled: ${session.line_reminder_scheduled}, Sent: ${session.line_reminder_sent_at}`);
            console.log(`     In window (30-70 min): ${minutesDiff >= 30 && minutesDiff <= 70}`);
            console.log(`     Meets all criteria: ${inWindow}`);
            
            if (!inWindow) {
              if (session.line_reminder_scheduled) console.log(`     - Already scheduled`);
              if (session.line_reminder_sent_at !== null) console.log(`     - Already sent`);
              if (session.user_id === null) console.log(`     - No user_id`);
              if (minutesDiff < 30) console.log(`     - Too soon (<30 min)`);
              if (minutesDiff > 70) console.log(`     - Too far (>70 min)`);
            }
          });
        }
      }
    }
    
    // Process each session
    const results = [];
    for (const session of (sessions || [])) {
      try {
        const subordinateName = session.subordinates.name;
        
        // Fetch LINE notification settings for this user
        console.log(`Checking LINE notifications for user ${session.user_id}`);
        const { data: lineNotification, error: lineError } = await supabase
          .from('line_notifications')
          .select('line_user_id, line_display_name, enabled, notification_types')
          .eq('user_id', session.user_id)
          .eq('enabled', true)
          .contains('notification_types', '["reminder"]')
          .maybeSingle();
        
        if (lineError) {
          console.error(`Error fetching LINE notification for user ${session.user_id}:`, lineError);
          continue;
        }
        
        console.log(`LINE notification query result for user ${session.user_id}:`, {
          hasData: !!lineNotification,
          lineUserId: lineNotification?.line_user_id,
          enabled: lineNotification?.enabled,
          notificationTypes: lineNotification?.notification_types,
          lineDisplayName: lineNotification?.line_display_name
        });
        
        if (!lineNotification || !lineNotification.line_user_id) {
          // No LINE notification setup for this user
          console.log(`No LINE notification found or line_user_id missing for user ${session.user_id}`);
          continue;
        }
        
        const lineUserId = lineNotification.line_user_id;
        
        // Send LINE notification
        const message = `1時間後に1on1セッション「${subordinateName || '部下'}」が予定されています。準備をしましょう！`;
        const sent = await sendLineNotification(lineUserId, message);
        
        if (sent) {
          // Update session record
          const { error: updateError } = await supabase
            .from('sessions')
            .update({
              line_reminder_scheduled: true,
              line_reminder_sent_at: nowUTC,
            })
            .eq('id', session.id);
          
          if (updateError) {
            console.error(`Failed to update session ${session.id}:`, updateError);
          } else {
            console.log(`Successfully sent LINE reminder for session ${session.id}`);
          }
          
          // Log the notification
          await logNotification(session.user_id, session.id, 'reminder', message, 'sent');
        } else {
          console.error(`Failed to send LINE reminder for session ${session.id}`);
          await logNotification(session.user_id, session.id, 'reminder', message, 'failed', 'LINE API error');
        }
        
        results.push({
          sessionId: session.id,
          sent,
          lineUserId,
          message,
        });
      } catch (err) {
        console.error(`Error processing session ${session.id}:`, err);
        results.push({
          sessionId: session.id,
          sent: false,
          error: err.message,
        });
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      results,
      timestamp: nowUTC,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Unhandled error in LINE reminder function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Send LINE notification to a user
 */
async function sendLineNotification(lineUserId: string, message: string): Promise<boolean> {
  if (!lineMessagingAccessToken) {
    console.error('LINE_MESSAGING_ACCESS_TOKEN not configured');
    return false;
  }
  
  try {
    const response = await fetch(LINE_MESSAGING_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lineMessagingAccessToken}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [
          {
            type: 'text',
            text: message,
          },
        ],
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`LINE API error: ${response.status} ${errorText}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Failed to send LINE notification:', error);
    return false;
  }
}

/**
 * Log notification to database
 */
async function logNotification(
  userId: string,
  sessionId: string,
  type: string,
  message: string,
  status: string,
  errorMessage?: string
): Promise<void> {
  try {
    await supabase
      .from('notification_logs')
      .insert({
        user_id: userId,
        session_id: sessionId,
        notification_type: type,
        message,
        status,
        error_message: errorMessage,
        sent_at: status === 'sent' ? new Date().toISOString() : null,
      });
  } catch (error) {
    console.error('Failed to log notification:', error);
  }
}