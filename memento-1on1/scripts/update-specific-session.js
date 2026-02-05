#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

async function updateSpecificSession() {
  console.log('🔍 Updating specific session with user_id...');
  
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
    .select('user_id, line_user_id, enabled')
    .eq('enabled', true)
    .limit(1);
  
  if (lineError) {
    console.error('❌ Error fetching line_notifications:', lineError.message);
    process.exit(1);
  }
  
  if (!lineNotifications || lineNotifications.length === 0) {
    console.error('❌ No users with LINE notifications enabled');
    process.exit(1);
  }
  
  const userId = lineNotifications[0].user_id;
  const lineUserId = lineNotifications[0].line_user_id;
  console.log(`✅ Found user with LINE notifications: ${userId} (LINE: ${lineUserId})`);
  
  // Specific session ID from earlier debug
  const sessionId = '820b8b06-4270-42f5-a0ae-c5420fe42455';
  
  // First check current session
  const { data: session, error: fetchError } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
  
  if (fetchError) {
    console.error(`❌ Error fetching session ${sessionId}:`, fetchError.message);
    process.exit(1);
  }
  
  console.log(`✅ Current session ${sessionId}:`);
  console.log(`  Next session date: ${session.next_session_date}`);
  console.log(`  User ID: ${session.user_id}`);
  console.log(`  Subordinate ID: ${session.subordinate_id}`);
  console.log(`  Line reminder scheduled: ${session.line_reminder_scheduled}`);
  console.log(`  Line reminder sent at: ${session.line_reminder_sent_at}`);
  
  // Update the session with user_id
  const { data: updatedSession, error: updateError } = await supabase
    .from('sessions')
    .update({ user_id: userId })
    .eq('id', sessionId)
    .select();
  
  if (updateError) {
    console.error('❌ Error updating session:', updateError.message);
    process.exit(1);
  }
  
  console.log(`✅ Successfully updated session ${sessionId} with user_id ${userId}`);
  
  // Verify and calculate timing
  const now = new Date();
  const sessionTime = new Date(session.next_session_date);
  const minutesDiff = (sessionTime.getTime() - now.getTime()) / (1000 * 60);
  console.log(`\n=== Timing Analysis ===`);
  console.log(`Current time (UTC): ${now.toISOString()}`);
  console.log(`Session time (UTC): ${session.next_session_date}`);
  console.log(`Minutes difference: ${minutesDiff.toFixed(2)}`);
  
  // Edge Function window (50-70 minutes)
  const startWindow = new Date(now.getTime() + 50 * 60 * 1000);
  const endWindow = new Date(now.getTime() + 70 * 60 * 1000);
  const inWindow = minutesDiff >= 50 && minutesDiff <= 70;
  console.log(`Edge Function window: ${startWindow.toISOString()} to ${endWindow.toISOString()}`);
  console.log(`Session in window (50-70 min): ${inWindow ? 'YES' : 'NO'}`);
  
  if (!inWindow) {
    console.log(`\n⚠️  Session is not in the 50-70 minute window.`);
    console.log(`   Next cron run will be in about 5 minutes.`);
    console.log(`   At that time, minutes difference will be ${(minutesDiff - 5).toFixed(2)}.`);
    
    // Calculate when it will enter the window
    const minutesToWindow = 50 - minutesDiff;
    if (minutesToWindow > 0) {
      console.log(`   Session will enter window in ${minutesToWindow.toFixed(2)} minutes.`);
    }
  } else {
    console.log(`\n✅ Session should be detected by Edge Function on next cron run!`);
  }
  
  // Also update line_reminder_scheduled to false (just in case)
  await supabase
    .from('sessions')
    .update({ line_reminder_scheduled: false })
    .eq('id', sessionId);
  
  console.log(`\n✅ Session ${sessionId} is ready for LINE reminder testing.`);
}

updateSpecificSession().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});