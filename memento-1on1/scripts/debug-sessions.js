#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

async function debugSessions() {
  console.log('🔍 Debugging sessions for LINE reminders...');
  
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
  
  // Calculate time window: sessions starting in the next hour (30-70 minutes from now)
  const startWindow = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
  const endWindow = new Date(now.getTime() + 70 * 60 * 1000); // 70 minutes from now
  
  console.log(`=== Current Time ===`);
  console.log(`UTC: ${nowUTC}`);
  console.log(`Local: ${now.toString()}`);
  console.log();
  
  console.log(`=== Time Window ===`);
  console.log(`Start (55 min from now): ${startWindow.toISOString()}`);
  console.log(`End (65 min from now): ${endWindow.toISOString()}`);
  console.log(`Window width: ${(endWindow.getTime() - startWindow.getTime()) / (1000 * 60)} minutes`);
  console.log();
  
  console.log(`=== Query Conditions ===`);
  console.log(`1. line_reminder_scheduled = false`);
  console.log(`2. line_reminder_sent_at IS NULL`);
  console.log(`3. next_session_date IS NOT NULL`);
  console.log(`4. next_session_date BETWEEN ${startWindow.toISOString()} AND ${endWindow.toISOString()}`);
  console.log(`5. subordinates!inner(name) join`);
  console.log();
  
  // Query 1: Exact same query as Edge Function
  console.log(`=== Query 1: Edge Function Query ===`);
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
    .gte('next_session_date', startWindow.toISOString())
    .lte('next_session_date', endWindow.toISOString());
  
  if (error) {
    console.error('❌ Error querying sessions:', error.message);
  } else {
    console.log(`Found ${sessions?.length || 0} sessions`);
    if (sessions && sessions.length > 0) {
      sessions.forEach((session, index) => {
        const sessionTime = new Date(session.next_session_date);
        const minutesDiff = (sessionTime.getTime() - now.getTime()) / (1000 * 60);
        console.log(`  Session ${index + 1}:`);
        console.log(`    ID: ${session.id}`);
        console.log(`    User ID: ${session.user_id}`);
        console.log(`    Subordinate ID: ${session.subordinate_id}`);
        console.log(`    Next Session Date: ${session.next_session_date}`);
        console.log(`    Local Time: ${sessionTime.toString()}`);
        console.log(`    Minutes from now: ${minutesDiff.toFixed(2)}`);
        console.log(`    Subordinate Name: ${session.subordinates?.name || 'N/A'}`);
        console.log(`    line_reminder_scheduled: ${session.line_reminder_scheduled}`);
        console.log(`    line_reminder_sent_at: ${session.line_reminder_sent_at}`);
        console.log();
      });
    }
  }
  
  console.log();
  
  // Query 2: Broader query to see all sessions in the next 2 hours
  console.log(`=== Query 2: All sessions in next 2 hours (for reference) ===`);
  const twoHoursLater = new Date(now.getTime() + 120 * 60 * 1000);
  const { data: allSessions, error: allError } = await supabase
    .from('sessions')
    .select(`
      id,
      subordinate_id,
      user_id,
      next_session_date,
      line_reminder_scheduled,
      line_reminder_sent_at
    `)
    .not('next_session_date', 'is', null)
    .gte('next_session_date', now.toISOString())
    .lte('next_session_date', twoHoursLater.toISOString())
    .order('next_session_date', { ascending: true });
  
  if (allError) {
    console.error('❌ Error querying all sessions:', allError.message);
  } else {
    console.log(`Found ${allSessions?.length || 0} sessions in next 2 hours`);
    if (allSessions && allSessions.length > 0) {
      allSessions.forEach((session) => {
        const sessionTime = new Date(session.next_session_date);
        const minutesDiff = (sessionTime.getTime() - now.getTime()) / (1000 * 60);
        console.log(`  - ${session.id}: ${session.next_session_date} (${minutesDiff.toFixed(1)} min from now), scheduled: ${session.line_reminder_scheduled}, sent_at: ${session.line_reminder_sent_at}`);
      });
    }
  }
  
  console.log();
  
  // Query 3: Check specific session that should be found (based on previous investigation)
  console.log(`=== Query 3: Check for session with next_session_date = 2026-01-25T18:55:00+00:00 ===`);
  const { data: specificSession, error: specificError } = await supabase
    .from('sessions')
    .select('*')
    .eq('next_session_date', '2026-01-25T18:55:00+00:00');
  
  if (specificError) {
    console.error('❌ Error querying specific session:', specificError.message);
  } else {
    console.log(`Found ${specificSession?.length || 0} sessions with that exact time`);
    if (specificSession && specificSession.length > 0) {
      specificSession.forEach((session, index) => {
        console.log(`  Session ${index + 1}:`);
        console.log(`    ID: ${session.id}`);
        console.log(`    User ID: ${session.user_id}`);
        console.log(`    Subordinate ID: ${session.subordinate_id}`);
        console.log(`    line_reminder_scheduled: ${session.line_reminder_scheduled}`);
        console.log(`    line_reminder_sent_at: ${session.line_reminder_sent_at}`);
        console.log(`    All columns:`, JSON.stringify(session, null, 2));
      });
    }
  }
  
  console.log();
  
  // Query 4: Check subordinates join issue
  console.log(`=== Query 4: Check if session has matching subordinate ===`);
  if (sessions && sessions.length === 0) {
    // Get any session in the window without the join
    const { data: sessionsNoJoin, error: noJoinError } = await supabase
      .from('sessions')
      .select('id, subordinate_id, next_session_date')
      .not('next_session_date', 'is', null)
      .gte('next_session_date', startWindow.toISOString())
      .lte('next_session_date', endWindow.toISOString())
      .limit(1);
    
    if (noJoinError) {
      console.error('❌ Error querying sessions without join:', noJoinError.message);
    } else if (sessionsNoJoin && sessionsNoJoin.length > 0) {
      const session = sessionsNoJoin[0];
      console.log(`Found session ${session.id} with subordinate_id ${session.subordinate_id}`);
      
      // Check if subordinate exists
      const { data: subordinate, error: subError } = await supabase
        .from('subordinates')
        .select('id, name')
        .eq('id', session.subordinate_id)
        .single();
      
      if (subError) {
        console.log(`  Subordinate ${session.subordinate_id} NOT found: ${subError.message}`);
      } else {
        console.log(`  Subordinate found: ${subordinate.name} (${subordinate.id})`);
      }
    } else {
      console.log(`No sessions found in the time window (even without join)`);
    }
  }
}

debugSessions().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});