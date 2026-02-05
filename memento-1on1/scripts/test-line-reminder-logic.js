#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

async function testLineReminderLogic() {
  console.log('🔍 Testing LINE reminder logic...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('❌ Supabase environment variables not set');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  
  // Get current time in UTC
  const now = new Date();
  const nowUTC = now.toISOString();
  
  // Calculate time window: sessions starting in 30-70 minutes from now
  const startWindow = new Date(now.getTime() + 30 * 60 * 1000);
  const endWindow = new Date(now.getTime() + 70 * 60 * 1000);
  
  console.log(`=== Current Time ===`);
  console.log(`UTC: ${nowUTC}`);
  console.log(`Local: ${now.toString()}`);
  console.log();
  
  console.log(`=== Time Window ===`);
  console.log(`Start (30 min from now): ${startWindow.toISOString()}`);
  console.log(`End (70 min from now): ${endWindow.toISOString()}`);
  console.log();
  
  // Query sessions that need LINE reminders (same as Edge Function)
  console.log(`=== Querying sessions ===`);
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
    .not('user_id', 'is', null)
    .gte('next_session_date', startWindow.toISOString())
    .lte('next_session_date', endWindow.toISOString());
  
  if (error) {
    console.error('❌ Error querying sessions:', error.message);
    process.exit(1);
  }
  
  console.log(`Found ${sessions?.length || 0} sessions needing LINE reminders`);
  console.log();
  
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
      console.log();
      
      // Test LINE notification fetch for this session
      testLineNotificationForUser(session.user_id);
    });
  } else {
    console.log(`=== No Sessions Found ===`);
    console.log(`Possible reasons:`);
    console.log(`1. No sessions in database with next_session_date in the window`);
    console.log(`2. All sessions already have line_reminder_scheduled = true`);
    console.log(`3. All sessions already have line_reminder_sent_at set`);
    console.log(`4. user_id IS NULL (sessions without user association)`);
    console.log(`5. subordinates!inner join failing (no matching subordinate)`);
    console.log(`6. Time window miscalculation`);
  }
  
  async function testLineNotificationForUser(userId) {
    console.log(`  Testing LINE notification fetch for user ${userId}...`);
    
    // Fetch LINE notification settings for this user
    const { data: lineNotification, error: lineError } = await supabase
      .from('line_notifications')
      .select('line_user_id, line_display_name, enabled, notification_types')
      .eq('user_id', userId)
      .eq('enabled', true)
      .contains('notification_types', '["reminder"]')
      .maybeSingle();
    
    if (lineError) {
      console.log(`  ❌ Error fetching LINE notification: ${lineError.message}`);
      console.log(`     Code: ${lineError.code}`);
      console.log(`     Details: ${lineError.details}`);
    } else {
      console.log(`  ✅ Successfully fetched LINE notification`);
      console.log(`     Line User ID: ${lineNotification?.line_user_id || 'N/A'}`);
      console.log(`     Enabled: ${lineNotification?.enabled || false}`);
      console.log(`     Notification Types: ${JSON.stringify(lineNotification?.notification_types || [])}`);
      
      if (lineNotification && lineNotification.line_user_id) {
        console.log(`  ✅ User has LINE notifications enabled with reminder type`);
        console.log(`  ✅ LINE notification would be sent to: ${lineNotification.line_user_id}`);
      } else {
        console.log(`  ❌ User does not have LINE notifications enabled for reminders`);
      }
    }
    console.log();
  }
}

testLineReminderLogic().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});