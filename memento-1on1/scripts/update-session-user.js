#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

async function updateSessionUser() {
  console.log('🔍 Updating session with user_id from line_notifications...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('❌ Supabase environment variables not set');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  
  // Get a user with LINE notifications enabled
  const { data: lineNotifications, error: lineError } = await supabase
    .from('line_notifications')
    .select('user_id, line_user_id, enabled, notification_types')
    .eq('enabled', true)
    .limit(1);
  
  if (lineError) {
    console.error('❌ Error fetching line_notifications:', lineError.message);
    process.exit(1);
  }
  
  if (!lineNotifications || lineNotifications.length === 0) {
    console.error('❌ No users with LINE notifications enabled for reminders');
    process.exit(1);
  }
  
  const userId = lineNotifications[0].user_id;
  const lineUserId = lineNotifications[0].line_user_id;
  console.log(`✅ Found user with LINE notifications: ${userId} (LINE: ${lineUserId})`);
  
  // Get a session without user_id but with next_session_date in the future
  const now = new Date();
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, subordinate_id, next_session_date, user_id')
    .is('user_id', null)
    .not('next_session_date', 'is', null)
    .gte('next_session_date', now.toISOString())
    .order('next_session_date', { ascending: true })
    .limit(1);
  
  if (sessionsError) {
    console.error('❌ Error fetching sessions:', sessionsError.error);
    process.exit(1);
  }
  
  if (!sessions || sessions.length === 0) {
    console.error('❌ No sessions without user_id and with future next_session_date');
    process.exit(1);
  }
  
  const session = sessions[0];
  console.log(`✅ Found session to update: ${session.id}`);
  console.log(`  Next session date: ${session.next_session_date}`);
  console.log(`  Subordinate ID: ${session.subordinate_id}`);
  console.log(`  Current user_id: ${session.user_id}`);
  
  // Update the session with user_id
  const { data: updatedSession, error: updateError } = await supabase
    .from('sessions')
    .update({ user_id: userId })
    .eq('id', session.id)
    .select();
  
  if (updateError) {
    console.error('❌ Error updating session:', updateError.message);
    process.exit(1);
  }
  
  console.log(`✅ Successfully updated session ${session.id} with user_id ${userId}`);
  
  // Verify the update
  const { data: verifiedSession, error: verifyError } = await supabase
    .from('sessions')
    .select('id, user_id, next_session_date, line_reminder_scheduled, line_reminder_sent_at')
    .eq('id', session.id)
    .single();
  
  if (verifyError) {
    console.error('❌ Error verifying update:', verifyError.message);
  } else {
    console.log(`✅ Verification:`);
    console.log(`  Session ID: ${verifiedSession.id}`);
    console.log(`  User ID: ${verifiedSession.user_id}`);
    console.log(`  Next Session Date: ${verifiedSession.next_session_date}`);
    console.log(`  Line reminder scheduled: ${verifiedSession.line_reminder_scheduled}`);
    console.log(`  Line reminder sent at: ${verifiedSession.line_reminder_sent_at}`);
    
    // Calculate time difference
    const sessionTime = new Date(verifiedSession.next_session_date);
    const minutesDiff = (sessionTime.getTime() - now.getTime()) / (1000 * 60);
    console.log(`  Minutes from now: ${minutesDiff.toFixed(2)}`);
    
    // Check if session would be found by Edge Function
    const startWindow = new Date(now.getTime() + 50 * 60 * 1000);
    const endWindow = new Date(now.getTime() + 70 * 60 * 1000);
    const inWindow = sessionTime >= startWindow && sessionTime <= endWindow;
    console.log(`  In Edge Function window (50-70 min): ${inWindow ? 'YES' : 'NO'}`);
    console.log(`  Window: ${startWindow.toISOString()} to ${endWindow.toISOString()}`);
  }
}

updateSessionUser().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});