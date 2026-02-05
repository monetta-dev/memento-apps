#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

async function createTestSession() {
  console.log('🔍 Creating test session for LINE reminder testing...');
  
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
  
  // Get existing subordinate
  const { data: subordinates, error: subError } = await supabase
    .from('subordinates')
    .select('id, name')
    .limit(1);
  
  if (subError) {
    console.error('❌ Error fetching subordinates:', subError.message);
    process.exit(1);
  }
  
  if (!subordinates || subordinates.length === 0) {
    console.error('❌ No subordinates found');
    process.exit(1);
  }
  
  const subordinateId = subordinates[0].id;
  const subordinateName = subordinates[0].name;
  console.log(`✅ Using subordinate: ${subordinateName} (${subordinateId})`);
  
  // Calculate session time: 70 minutes from now (within Edge Function window)
  const now = new Date();
  const sessionTime = new Date(now.getTime() + 70 * 60 * 1000);
  const sessionId = crypto.randomUUID();
  
  console.log(`\n=== Creating Test Session ===`);
  console.log(`Session ID: ${sessionId}`);
  console.log(`Session Time (UTC): ${sessionTime.toISOString()}`);
  console.log(`User ID: ${userId}`);
  console.log(`Subordinate ID: ${subordinateId}`);
  console.log(`Current Time (UTC): ${now.toISOString()}`);
  console.log(`Minutes from now: ${(sessionTime.getTime() - now.getTime()) / (1000 * 60)}`);
  
  // Create session
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert([{
      id: sessionId,
      subordinate_id: subordinateId,
      date: now.toISOString(), // Original session date (past)
      mode: 'face-to-face',
      theme: 'Test session for LINE reminders',
      summary: 'Test session created for LINE reminder system testing',
      status: 'completed',
      transcript: [],
      mind_map_data: {
        nodes: [],
        edges: [],
        actionItems: []
      },
      agenda_items: [],
      notes: [],
      user_id: userId,
      next_session_date: sessionTime.toISOString(),
      next_session_duration_minutes: 60,
      line_reminder_scheduled: false,
      line_reminder_sent_at: null
    }])
    .select()
    .single();
  
  if (sessionError) {
    console.error('❌ Error creating session:', sessionError.message);
    process.exit(1);
  }
  
  console.log(`✅ Successfully created test session: ${session.id}`);
  console.log(`\n=== Verification ===`);
  
  // Verify the session would be found by Edge Function
  const startWindow = new Date(now.getTime() + 30 * 60 * 1000);
  const endWindow = new Date(now.getTime() + 70 * 60 * 1000);
  const inWindow = sessionTime >= startWindow && sessionTime <= endWindow;
  
  console.log(`Edge Function window: ${startWindow.toISOString()} to ${endWindow.toISOString()}`);
  console.log(`Session in window (30-70 min): ${inWindow ? 'YES' : 'NO'}`);
  
  if (inWindow) {
    console.log(`✅ Session should be detected by Edge Function on next cron run!`);
  } else {
    console.log(`❌ Session is NOT in the Edge Function window`);
    console.log(`   Adjust the session time to be 30-70 minutes from now`);
  }
  
  // Test Edge Function query
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
    console.log(`✅ Edge Function query test:`);
    console.log(`   Would be found: ${testSessions && testSessions.length > 0 ? 'YES' : 'NO'}`);
    if (testSessions && testSessions.length > 0) {
      const testSession = testSessions[0];
      const sessionTime = new Date(testSession.next_session_date);
      const minutesDiff = (sessionTime.getTime() - now.getTime()) / (1000 * 60);
      console.log(`   Session: ${testSession.id}`);
      console.log(`   Minutes from now: ${minutesDiff.toFixed(2)}`);
      console.log(`   Subordinate name: ${testSession.subordinates?.name || 'N/A'}`);
    }
  }
  
  console.log(`\n🎯 Next steps:`);
  console.log(`1. Wait for next cron run (every 5 minutes)`);
  console.log(`2. Or manually trigger Edge Function:`);
  console.log(`   curl -X POST "https://hslojwtodnfaucrnbcdc.supabase.co/functions/v1/send-line-reminders" \\`);
  console.log(`     -H "Authorization: Bearer ${supabaseServiceRoleKey}"`);
}

createTestSession().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});