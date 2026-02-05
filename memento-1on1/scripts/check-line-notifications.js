#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

async function checkLineNotifications() {
  console.log('🔍 Checking line_notifications table structure and data...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('❌ Supabase environment variables not set');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  
  // Get all line_notifications
  const { data: notifications, error } = await supabase
    .from('line_notifications')
    .select('*');
  
  if (error) {
    console.error('❌ Error fetching line_notifications:', error.message);
    process.exit(1);
  }
  
  console.log(`Found ${notifications?.length || 0} line notifications`);
  console.log();
  
   if (notifications && notifications.length > 0) {
     notifications.forEach((notif, index) => {
       console.log(`=== Notification ${index + 1} ===`);
       console.log(`User ID: ${notif.user_id}`);
       console.log(`Line User ID: ${notif.line_user_id}`);
       console.log(`Enabled: ${notif.enabled}`);
       console.log(`Is Friend: ${notif.is_friend}`);
       console.log(`Friend Status Checked At: ${notif.friend_status_checked_at}`);
       console.log(`Notification Types: ${JSON.stringify(notif.notification_types)}`);
       console.log(`Type of notification_types: ${typeof notif.notification_types}`);
       
       if (notif.notification_types) {
         console.log(`Is Array: ${Array.isArray(notif.notification_types)}`);
         console.log(`Stringified: ${JSON.stringify(notif.notification_types)}`);
         console.log(`Contains "reminder": ${notif.notification_types.includes('reminder')}`);
       }
       console.log();
     });
  }
  
  // Test the contains query that's failing in Edge Function
  console.log('=== Testing contains query ===');
  const { data: containsTest, error: containsError } = await supabase
    .from('line_notifications')
    .select('user_id, notification_types')
    .eq('user_id', 'd446e167-b7be-461f-a5f7-a927fa732000')
    .contains('notification_types', ['reminder']);
  
  if (containsError) {
    console.log(`❌ contains query error: ${containsError.message}`);
    console.log(`Error code: ${containsError.code}`);
    console.log(`Error details: ${containsError.details}`);
  } else {
    console.log(`✅ contains query successful`);
    console.log(`Found ${containsTest?.length || 0} results`);
  }
  
  console.log();
  
  // Test alternative query using raw JSONB operator
  console.log('=== Testing alternative query (notification_types ? \'reminder\') ===');
  const { data: altTest, error: altError } = await supabase
    .from('line_notifications')
    .select('user_id, notification_types')
    .eq('user_id', 'd446e167-b7be-461f-a5f7-a927fa732000')
    .or('notification_types.cs.{"reminder"}'); // Using contains operator
  
  if (altError) {
    console.log(`❌ Alternative query error: ${altError.message}`);
  } else {
    console.log(`✅ Alternative query successful`);
    console.log(`Found ${altTest?.length || 0} results`);
  }
}

checkLineNotifications().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});