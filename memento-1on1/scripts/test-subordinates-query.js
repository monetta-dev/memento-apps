const dotenv = require('dotenv');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  console.log('Testing subordinates query with test user...');
  
  // First, get the test user ID
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_USER_EMAIL || 'test@memento-1on1.com',
    password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
  });
  
  if (authError) {
    console.error('Auth error:', authError.message);
    return;
  }
  
  const userId = authData.user.id;
  console.log('Test user ID:', userId);
  
  // Query subordinates with user_id filter
  const { data, error } = await supabase
    .from('subordinates')
    .select('*')
    .eq('user_id', userId);
    
  if (error) {
    console.error('Query error:', error.message);
  } else {
    console.log('Subordinates count:', data.length);
    console.log('Subordinates:', data);
  }
  
  // Also query without filter to see all
  const { data: allData } = await supabase.from('subordinates').select('*');
  console.log('All subordinates count:', allData.length);
}

testQuery().catch(console.error);