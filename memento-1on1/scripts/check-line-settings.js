const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkLineSettings() {
  console.log('=== Checking LINE Notification Settings ===\n');
  
  // Get current user ID from sessions
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('user_id')
    .not('user_id', 'is', null)
    .limit(5);
    
  if (sessionsError) {
    console.error('Error fetching sessions:', sessionsError);
    return;
  }
  
  const userIds = [...new Set(sessions.map(s => s.user_id))];
  console.log(`Found ${userIds.length} unique user IDs in sessions:`, userIds);
  
  for (const userId of userIds) {
    console.log(`\n=== User ID: ${userId} ===`);
    
    // Check LINE notifications for this user
    const { data: lineNotifications, error: lineError } = await supabase
      .from('line_notifications')
      .select('*')
      .eq('user_id', userId);
      
    if (lineError) {
      console.error(`Error fetching LINE notifications:`, lineError);
      continue;
    }
    
    if (!lineNotifications || lineNotifications.length === 0) {
      console.log('No LINE notification settings found for this user');
      continue;
    }
    
     console.log(`Found ${lineNotifications.length} LINE notification settings:`);
     lineNotifications.forEach((setting, index) => {
       console.log(`\nSetting ${index + 1}:`);
       console.log(`  ID: ${setting.id}`);
       console.log(`  LINE User ID: ${setting.line_user_id}`);
       console.log(`  LINE Display Name: ${setting.line_display_name}`);
       console.log(`  Enabled: ${setting.enabled}`);
       console.log(`  Is Friend: ${setting.is_friend}`);
       console.log(`  Friend Status Checked At: ${setting.friend_status_checked_at}`);
       console.log(`  Notification Types: ${JSON.stringify(setting.notification_types)}`);
       console.log(`  Created: ${setting.created_at}`);
       console.log(`  Updated: ${setting.updated_at}`);
       
       // Check if 'reminder' is in notification_types
       const hasReminder = setting.notification_types && 
                          Array.isArray(setting.notification_types) &&
                          setting.notification_types.includes('reminder');
       console.log(`  Has 'reminder' type: ${hasReminder}`);
       
       // Check if this would match the function query
       const wouldMatch = setting.enabled && 
                         hasReminder && 
                         setting.line_user_id;
       console.log(`  Would match function query: ${wouldMatch}`);
     });
  }
  
  // Also check the exact user ID from test sessions
  const testUserId = 'd446e167-b7be-461f-a5f7-a927fa732000';
  console.log(`\n=== Detailed check for test user ${testUserId} ===`);
  
  const { data: testUserSettings, error: testError } = await supabase
    .from('line_notifications')
    .select('*')
    .eq('user_id', testUserId);
    
  if (testError) {
    console.error('Error:', testError);
  } else if (!testUserSettings || testUserSettings.length === 0) {
    console.log('No LINE notification settings found for test user');
  } else {
    console.log('Test user settings:', JSON.stringify(testUserSettings, null, 2));
  }
}

checkLineSettings().catch(console.error);