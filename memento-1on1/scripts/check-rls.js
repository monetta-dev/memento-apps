const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
  console.log('=== Checking RLS policies and data ===\n');
  
  // 1. First sign in as test user to test RLS
  console.log('1. Signing in as test user...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_USER_EMAIL || 'test@memento-1on1.com',
    password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
  });
  
  if (authError) {
    console.error('Auth error:', authError.message);
    return;
  }
  
  const userId = authData.user.id;
  console.log('✓ Test user ID:', userId);
  
  // 2. Query subordinates as authenticated user (should respect RLS)
  console.log('\n2. Querying subordinates with authenticated client...');
  const { data: subData, error: subError } = await supabase
    .from('subordinates')
    .select('*');
    
  if (subError) {
    console.error('Query error:', subError.message);
  } else {
    console.log(`✓ Subordinates count: ${subData.length}`);
    subData.forEach((sub, i) => {
      console.log(`  ${i + 1}. ${sub.name} (ID: ${sub.id}, user_id: ${sub.user_id})`);
    });
  }
  
  // 3. Use service role to bypass RLS and see all data
  console.log('\n3. Querying all subordinates with service role (bypass RLS)...');
  
  // Create a new client with service role key
  const serviceRoleClient = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: allSubData, error: allSubError } = await serviceRoleClient
    .from('subordinates')
    .select('*');
    
  if (allSubError) {
    console.error('Service role query error:', allSubError.message);
  } else {
    console.log(`✓ All subordinates count: ${allSubData.length}`);
    allSubData.forEach((sub, i) => {
      console.log(`  ${i + 1}. ${sub.name} (ID: ${sub.id}, user_id: ${sub.user_id})`);
    });
  }
  
  // 4. Check if user_id matches
  console.log('\n4. Checking user_id consistency...');
  const userSubordinates = allSubData.filter(sub => sub.user_id === userId);
  console.log(`✓ Subordinates belonging to test user: ${userSubordinates.length}`);
  
  // 5. Sign out
  await supabase.auth.signOut();
  console.log('\n✓ Done.');
}

checkRLS().catch(console.error);