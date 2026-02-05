#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

async function testContainsSyntax() {
  console.log('🔍 Testing different contains syntax for notification_types...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('❌ Supabase environment variables not set');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const userId = 'd446e167-b7be-461f-a5f7-a927fa732000';
  
  const tests = [
    {
      name: 'Original: contains with array ["reminder"]',
      query: () => supabase
        .from('line_notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('enabled', true)
        .contains('notification_types', ['reminder'])
        .maybeSingle()
    },
    {
      name: 'String contains: "reminder"',
      query: () => supabase
        .from('line_notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('enabled', true)
        .contains('notification_types', 'reminder')
        .maybeSingle()
    },
    {
      name: 'JSON string contains: \'["reminder"]\'',
      query: () => supabase
        .from('line_notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('enabled', true)
        .contains('notification_types', '["reminder"]')
        .maybeSingle()
    },
    {
      name: 'JSON string contains: \'{"reminder"}\'',
      query: () => supabase
        .from('line_notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('enabled', true)
        .contains('notification_types', '{"reminder"}')
        .maybeSingle()
    },
    {
      name: 'Using filter with cs operator',
      query: () => supabase
        .from('line_notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('enabled', true)
        .filter('notification_types', 'cs', '{"reminder"}')
        .maybeSingle()
    },
    {
      name: 'Using filter with cs operator (array)',
      query: () => supabase
        .from('line_notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('enabled', true)
        .filter('notification_types', 'cs', '["reminder"]')
        .maybeSingle()
    },
    {
      name: 'Using raw SQL with or()',
      query: () => supabase
        .from('line_notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('enabled', true)
        .or('notification_types.cs.{"reminder"}')
        .maybeSingle()
    },
    {
      name: 'Simplified: Just check enabled and fetch all, filter in code',
      query: () => supabase
        .from('line_notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('enabled', true)
        .maybeSingle()
    }
  ];
  
  for (const test of tests) {
    console.log(`\n=== Test: ${test.name} ===`);
    try {
      const { data, error } = await test.query();
      
      if (error) {
        console.log(`❌ Error: ${error.message}`);
        console.log(`   Code: ${error.code}`);
        if (error.details) console.log(`   Details: ${error.details}`);
      } else {
        console.log(`✅ Success`);
        console.log(`   Data: ${JSON.stringify(data)}`);
        if (data) {
          console.log(`   Has notification_types: ${!!data.notification_types}`);
          console.log(`   notification_types: ${JSON.stringify(data.notification_types)}`);
          if (data.notification_types && Array.isArray(data.notification_types)) {
            console.log(`   Contains "reminder": ${data.notification_types.includes('reminder')}`);
          }
        }
      }
    } catch (err) {
      console.log(`❌ Exception: ${err.message}`);
    }
  }
}

testContainsSyntax().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});