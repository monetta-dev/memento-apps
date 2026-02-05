#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

async function checkSchema() {
  console.log('🔍 Checking database schema for new columns...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase environment variables not set');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // Try to query the sessions table with the new columns
  // We'll use a simple select with limit 0 to check if columns exist
  // Actually, we can query the information_schema, but anon key may not have access
  // Instead, try to insert a session with the new fields and see if it fails
  // But better: try to update a session with the new fields and see error
  
  // First, get a session ID to test with
  const { data: sessions, error: fetchError } = await supabase
    .from('sessions')
    .select('id')
    .limit(1);
    
  if (fetchError) {
    console.error('❌ Error fetching sessions:', fetchError.message);
    process.exit(1);
  }
  
  if (!sessions || sessions.length === 0) {
    console.log('⚠️  No sessions found, cannot test update');
    console.log('📋 Checking column existence by attempting to select with new columns...');
    
    // Try to select with hypothetical columns
    const { error: selectError } = await supabase
      .from('sessions')
      .select('next_session_date,next_session_duration_minutes,line_reminder_scheduled,line_reminder_sent_at')
      .limit(0); // limit 0 to avoid data transfer
      
    if (selectError && selectError.message.includes('column')) {
      console.log('❌ New columns do NOT exist in sessions table');
      console.log('Error:', selectError.message);
    } else {
      console.log('✅ New columns appear to exist in sessions table (or no error on select)');
    }
  } else {
    const sessionId = sessions[0].id;
    console.log(`📋 Testing update with new columns on session ${sessionId}...`);
    
    // Try to update with new columns
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        next_session_date: null,
        next_session_duration_minutes: null,
        line_reminder_scheduled: false,
        line_reminder_sent_at: null
      })
      .eq('id', sessionId);
      
    if (updateError) {
      if (updateError.message.includes('column')) {
        console.log('❌ New columns do NOT exist in sessions table');
        console.log('Error:', updateError.message);
      } else {
        console.log('⚠️  Update error (not column-related):', updateError.message);
      }
    } else {
      console.log('✅ New columns exist and can be updated');
      
      // Clean up: set them back to null
      await supabase
        .from('sessions')
        .update({
          next_session_date: null,
          next_session_duration_minutes: null,
          line_reminder_scheduled: null,
          line_reminder_sent_at: null
        })
        .eq('id', sessionId);
    }
  }
  
  // Also check line_notifications table for notification_types
  console.log('\n📋 Checking line_notifications table for notification_types column...');
  const { error: lineSelectError } = await supabase
    .from('line_notifications')
    .select('notification_types')
    .limit(0);
    
  if (lineSelectError && lineSelectError.message.includes('column')) {
    console.log('❌ notification_types column does NOT exist in line_notifications table');
  } else {
    console.log('✅ notification_types column appears to exist in line_notifications table');
  }
}

checkSchema().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});