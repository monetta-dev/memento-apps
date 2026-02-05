#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

async function getUsers() {
  console.log('🔍 Getting users from database...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('❌ Supabase environment variables not set');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  
  // Try different table names
  const tables = ['users', 'profiles', 'auth.users'];
  
  for (const table of tables) {
    console.log(`\n=== Trying table: ${table} ===`);
    try {
      // For auth.users we might need different permissions
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(2);
      
      if (error) {
        console.log(`Error: ${error.message}`);
      } else {
        console.log(`Found ${data?.length || 0} records`);
        if (data && data.length > 0) {
          console.log('First record:');
          console.log(JSON.stringify(data[0], null, 2));
        }
      }
    } catch (err) {
      console.log(`Exception: ${err.message}`);
    }
  }
  
  // Also check line_notifications table for user references
  console.log('\n=== Checking line_notifications table ===');
  const { data: lineNotifications, error: lineError } = await supabase
    .from('line_notifications')
    .select('user_id, line_user_id, enabled')
    .limit(5);
  
  if (lineError) {
    console.log(`Error: ${lineError.message}`);
  } else {
    console.log(`Found ${lineNotifications?.length || 0} line notifications`);
    if (lineNotifications && lineNotifications.length > 0) {
      console.log('Line notifications:');
      lineNotifications.forEach((notif, idx) => {
        console.log(`  ${idx + 1}. user_id: ${notif.user_id}, line_user_id: ${notif.line_user_id}, enabled: ${notif.enabled}`);
      });
    }
  }
}

getUsers().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});