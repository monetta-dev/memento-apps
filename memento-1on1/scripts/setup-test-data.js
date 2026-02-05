/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load test environment variables
const testEnvPath = path.resolve(__dirname, '../.env.test');
if (fs.existsSync(testEnvPath)) {
  console.log('Loading environment variables from .env.test');
  dotenv.config({ path: testEnvPath });
} else {
  console.error('.env.test file not found');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Use service role key to bypass RLS for setup
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function ensureSubordinate(userId) {
  console.log('Checking for existing subordinates...');
  
  const { data, error } = await supabase
    .from('subordinates')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Failed to fetch subordinates:', error.message);
    return null;
  }

  if (data && data.length > 0) {
    console.log(`✓ Found ${data.length} subordinate(s). First: ${data[0].name}`);
    return data[0];
  }

  console.log('No subordinates found, creating default subordinate...');
  
  const newSubordinate = {
    name: 'テスト部下',
    role: 'エンジニア',
    department: '開発部',
    traits: ['詳細志向', '論理的', '協調性'],
    user_id: userId, // Set user_id from parameter
  };

  const { data: inserted, error: insertError } = await supabase
    .from('subordinates')
    .insert(newSubordinate)
    .select()
    .single();

  if (insertError) {
    console.error('Failed to create subordinate:', insertError.message);
    return null;
  }

  console.log(`✓ Created default subordinate: ${inserted.name} (ID: ${inserted.id}) for user: ${userId}`);
  return inserted;
}

async function ensureTestUser() {
  const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@memento-1on1.com';
  const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestPassword123!';
  
  console.log('Checking test user...');
  
  // Try to sign in
   
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });

  if (!signInError) {
    console.log('✓ Test user exists and can log in');
    const userId = signInData.user.id;
    await supabase.auth.signOut();
    return userId;
  }

  console.log('Test user not found or cannot log in:', signInError.message);
  console.log('Attempting to create test user...');

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    options: {
      data: {
        full_name: process.env.TEST_USER_NAME || 'Test User',
      },
    },
  });

  if (signUpError) {
    console.error('✗ Failed to create test user:', signUpError.message);
    return null;
  }

  if (signUpData.user) {
    console.log('✓ Test user created:', signUpData.user.email);
    return signUpData.user.id;
  } else {
    console.log('⚠ User creation returned no user data - check email confirmation');
    return null;
  }
}



async function main() {
  console.log('=== Setting up test data ===\n');
  
  // Step 1: Ensure test user exists and get user ID
  const userId = await ensureTestUser();
  if (!userId) {
    console.log('\n❌ Test user setup failed. Tests may fail.');
  } else {
    console.log(`✓ Test user ID: ${userId}`);
  }
  
  // Step 2: Ensure at least one subordinate exists (pass user ID)
  const subordinate = await ensureSubordinate(userId);
  if (!subordinate) {
    console.log('\n❌ Could not ensure subordinate exists. Tests may fail.');
  }
  
  // Step 3: Optional cleanup (comment out if you want to keep data)
  // await cleanupOldTestData();
  
  console.log('\n=== Test data setup complete ===');
  console.log('Next steps:');
  console.log('1. Run tests with: npm run test:e2e');
  console.log('2. Run specific test: npm run test:e2e:auth');
  console.log('3. View results: npx playwright show-report');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });