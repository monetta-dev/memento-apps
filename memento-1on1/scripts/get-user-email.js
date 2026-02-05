#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

async function getUserEmail() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('❌ Supabase environment variables not set');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
  
  const userId = 'bfbe64e0-47c6-44e3-9902-09b886b1e4ce';
  
  console.log(`🔍 Looking up user ${userId}`);
  
  // Try to get user via auth admin API
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    
    if (error) {
      console.error('❌ Error fetching user via admin API:', error.message);
      
      // Fallback: query auth.users table directly
      console.log('🔍 Trying direct query to auth.users table...');
      const { data: userData, error: userError } = await supabase
        .from('auth.users')
        .select('id, email, created_at')
        .eq('id', userId)
        .maybeSingle();
        
      if (userError) {
        console.error('❌ Error querying auth.users:', userError.message);
        return;
      }
      
      if (userData) {
        console.log('✅ User found via direct query:');
        console.log(`   ID: ${userData.id}`);
        console.log(`   Email: ${userData.email}`);
        console.log(`   Created: ${userData.created_at}`);
      } else {
        console.log('❌ User not found');
      }
    } else if (data.user) {
      console.log('✅ User found via admin API:');
      console.log(`   ID: ${data.user.id}`);
      console.log(`   Email: ${data.user.email}`);
      console.log(`   Created: ${data.user.created_at}`);
    } else {
      console.log('❌ User not found via admin API');
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

getUserEmail().catch(console.error);