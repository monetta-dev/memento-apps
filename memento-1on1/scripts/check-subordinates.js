#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

async function checkSubordinates() {
  console.log('🔍 Checking subordinates table structure...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('❌ Supabase environment variables not set');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  
  // Get first subordinate to see structure
  const { data: subordinates, error } = await supabase
    .from('subordinates')
    .select('*')
    .limit(2);
  
  if (error) {
    console.error('❌ Error fetching subordinates:', error.message);
    process.exit(1);
  }
  
  console.log(`Found ${subordinates?.length || 0} subordinates`);
  if (subordinates && subordinates.length > 0) {
    console.log('First subordinate structure:');
    console.log(JSON.stringify(subordinates[0], null, 2));
  }
  
  // Check if user_id column exists by trying to select it
  const { error: userColumnError } = await supabase
    .from('subordinates')
    .select('user_id')
    .limit(0);
  
  if (userColumnError && userColumnError.message.includes('column')) {
    console.log('\n❌ user_id column does NOT exist in subordinates table');
  } else {
    console.log('\n✅ user_id column exists in subordinates table');
  }
  
  // Check sessions without user_id but with subordinate_id
  console.log('\n=== Sessions without user_id ===');
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, subordinate_id, user_id')
    .is('user_id', null)
    .not('subordinate_id', 'is', null)
    .limit(5);
  
  if (sessionsError) {
    console.error('Error fetching sessions:', sessionsError.message);
  } else {
    console.log(`Found ${sessions?.length || 0} sessions without user_id`);
    if (sessions && sessions.length > 0) {
      for (const session of sessions) {
        console.log(`\nSession ${session.id}:`);
        console.log(`  Subordinate ID: ${session.subordinate_id}`);
        
        // Get subordinate details
        const { data: subordinate, error: subError } = await supabase
          .from('subordinates')
          .select('*')
          .eq('id', session.subordinate_id)
          .single();
        
        if (subError) {
          console.log(`  Error fetching subordinate: ${subError.message}`);
        } else {
          console.log(`  Subordinate: ${JSON.stringify(subordinate, null, 2)}`);
        }
      }
    }
  }
}

checkSubordinates().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});