#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

async function updateNewSessionUser() {
  console.log('🔍 Updating new session with user_id...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('❌ Supabase environment variables not set');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  
  // New session ID
  const sessionId = '36d05f18-ae85-42d9-99cb-5567d8cc6e71';
  
  // Get user with LINE notifications enabled
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
  
  // Check current session
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
  console.log(`  Created at: ${session.created_at}`);
  console.log(`  Updated at: ${session.updated_at}`);
  
  // Check if subordinate exists
  if (session.subordinate_id) {
    const { data: subordinate, error: subError } = await supabase
      .from('subordinates')
      .select('id, name')
      .eq('id', session.subordinate_id)
      .single();
    
    if (subError) {
      console.log(`  ❌ Subordinate ${session.subordinate_id} NOT found: ${subError.message}`);
    } else {
      console.log(`  ✅ Subordinate found: ${subordinate.name} (${subordinate.id})`);
    }
  }
  
  // Update the session with user_id
  console.log(`\n🔄 Updating session ${sessionId} with user_id ${userId}...`);
  const { data: updatedSession, error: updateError } = await supabase
    .from('sessions')
    .update({ 
      user_id: userId,
      line_reminder_scheduled: false, // Ensure it's false
      line_reminder_sent_at: null // Ensure it's null
    })
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
  
  // Edge Function window (30-70 minutes)
  const startWindow = new Date(now.getTime() + 30 * 60 * 1000);
  const endWindow = new Date(now.getTime() + 70 * 60 * 1000);
  const inWindow = minutesDiff >= 30 && minutesDiff <= 70;
  console.log(`Edge Function window: ${startWindow.toISOString()} to ${endWindow.toISOString()}`);
  console.log(`Session in window (30-70 min): ${inWindow ? 'YES' : 'NO'}`);
  
  if (!inWindow) {
    console.log(`\n⚠️  Session is not in the 30-70 minute window.`);
    console.log(`   Current minutes difference: ${minutesDiff.toFixed(2)}`);
    console.log(`   Will enter window when difference is <= 70 and >= 30`);
    
    if (minutesDiff > 70) {
      const minutesToWindow = minutesDiff - 70;
      console.log(`   Session will enter window in ${minutesToWindow.toFixed(2)} minutes.`);
    } else if (minutesDiff < 30) {
      const minutesSinceWindow = 30 - minutesDiff;
      console.log(`   Session already passed window by ${minutesSinceWindow.toFixed(2)} minutes.`);
    }
  } else {
    console.log(`\n✅ Session should be detected by Edge Function on next cron run!`);
  }
  
  // Test if session would be found by Edge Function query
  console.log(`\n=== Edge Function Query Test ===`);
  const { data: testSessions, error: testError } = await supabase
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
    .eq('id', sessionId)
    .eq('line_reminder_scheduled', false)
    .is('line_reminder_sent_at', null)
    .not('next_session_date', 'is', null)
    .not('user_id', 'is', null)
    .gte('next_session_date', startWindow.toISOString())
    .lte('next_session_date', endWindow.toISOString());
  
  if (testError) {
    console.log(`❌ Test query error: ${testError.message}`);
  } else {
    console.log(`✅ Test query successful`);
    console.log(`   Would be found by Edge Function: ${testSessions && testSessions.length > 0 ? 'YES' : 'NO'}`);
    if (testSessions && testSessions.length > 0) {
      console.log(`   Found session: ${testSessions[0].id}`);
    }
  }
  
  console.log(`\n✅ Session ${sessionId} is ready for LINE reminder testing.`);
}

updateNewSessionUser().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});