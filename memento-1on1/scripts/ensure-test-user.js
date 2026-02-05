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
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@memento-1on1.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestPassword123!';
const TEST_USER_NAME = process.env.TEST_USER_NAME || 'Test User';

async function checkAndCreateTestUser() {
  console.log('Checking test user...');
  
  // Try to sign in
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });

  if (!signInError) {
    console.log('✓ Test user exists and can log in');
    console.log('  User ID:', signInData.user.id);
    console.log('  Email:', signInData.user.email);
    await supabase.auth.signOut();
    return true;
  }

  console.log('Test user not found or cannot log in:', signInError.message);
  console.log('Attempting to create test user...');

  // Try to sign up
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    options: {
      data: {
        full_name: TEST_USER_NAME,
      },
    },
  });

  if (signUpError) {
    console.error('✗ Failed to create test user:', signUpError.message);
    console.log('\nPossible solutions:');
    console.log('1. Check if email confirmation is required');
    console.log('2. Create user manually in Supabase dashboard');
    console.log('3. Use service role key for user creation');
    return false;
  }

  if (signUpData.user) {
    console.log('✓ Test user created:', signUpData.user.email);
    console.log('  Note: Email confirmation may be required');
    console.log('  User ID:', signUpData.user.id);
    
    // Try to sign in again to verify
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });
    
    if (verifyError) {
      console.log('⚠ User created but cannot log in yet:', verifyError.message);
    } else {
      console.log('✓ User can log in after creation');
    }
    
    return true;
  } else {
    console.log('⚠ User creation returned no user data - check email confirmation');
    return false;
  }
}

checkAndCreateTestUser()
  .then(success => {
    if (success) {
      console.log('\n✅ Test user setup completed');
    } else {
      console.log('\n❌ Test user setup failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });