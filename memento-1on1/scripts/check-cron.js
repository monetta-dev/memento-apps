#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

async function checkCron() {
  console.log('🔍 Checking cron job status...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Supabase service role environment variables not set');
    process.exit(1);
  }
  
  // Use service role key for elevated privileges
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Try to query cron.job table directly
    console.log('📋 Querying cron.job table...');
    
    // Method 1: Try using from() with schema prefix
    // Note: This may not work if cron schema is not in search path
    const { data, error } = await supabase
      .from('cron.job')
      .select('*')
      .like('jobname', '%send-line-reminders%');
    
    if (error) {
      console.log('⚠️  Error querying cron.job via from():', error.message);
      
      // Method 2: Try using rpc (custom function would be needed)
      console.log('📋 Alternative: Checking if cron job exists via information_schema...');
      
      // We can check if the cron job was created by checking if it appears in cron.job
      // But we need raw SQL for that. Let's try a different approach.
      // We'll just check if the edge function responds and assume cron is working.
    } else {
      console.log('✅ Cron job query successful');
      console.log('📊 Found cron jobs:', data.length);
      data.forEach(job => {
        console.log(`   - Job: ${job.jobname}, Schedule: ${job.schedule}`);
      });
      
      if (data.length === 0) {
        console.log('❌ No cron job found with name containing "send-line-reminders"');
        console.log('   Check if cron.schedule() executed successfully');
      } else {
        console.log('✅ Cron job appears to be scheduled');
      }
    }
    
    // Test the edge function directly
    console.log('\n📋 Testing edge function manually...');
    try {
      const response = await fetch('https://hslojwtodnfaucrnbcdc.supabase.co/functions/v1/send-line-reminders');
      const result = await response.text();
      console.log('✅ Edge function responds:', result.substring(0, 100) + '...');
    } catch (fetchError) {
      console.error('❌ Edge function test failed:', fetchError.message);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

checkCron().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});