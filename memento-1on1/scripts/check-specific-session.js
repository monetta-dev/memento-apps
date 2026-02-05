const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkSession() {
  console.log('=== Checking specific session ===\n');
  
  const sessionId = '883ea5a0-c9fe-4401-9d75-52989fab3aae';
  
  const { data: session, error } = await supabase
    .from('sessions')
    .select(`
      *,
      subordinates!inner(name)
    `)
    .eq('id', sessionId)
    .single();
    
  if (error) {
    console.error('Error fetching session:', error);
    return;
  }
  
  console.log('Session details:', JSON.stringify(session, null, 2));
  
  const now = new Date();
  const sessionTime = new Date(session.next_session_date);
  const minutesDiff = (sessionTime.getTime() - now.getTime()) / (1000 * 60);
  
  console.log(`\n=== Time Analysis ===`);
  console.log(`Current UTC: ${now.toISOString()}`);
  console.log(`Session UTC: ${session.next_session_date}`);
  console.log(`Minutes from now: ${minutesDiff.toFixed(2)}`);
  console.log(`Local session time: ${sessionTime.toString()}`);
  
  // Check function's time window (25-75 minutes)
  const startWindow = new Date(now.getTime() + 25 * 60 * 1000);
  const endWindow = new Date(now.getTime() + 75 * 60 * 1000);
  
  console.log(`\nFunction time window (25-75 min):`);
  console.log(`Start: ${startWindow.toISOString()}`);
  console.log(`End: ${endWindow.toISOString()}`);
  
  const isWithinWindow = sessionTime >= startWindow && sessionTime <= endWindow;
  console.log(`Is session within window: ${isWithinWindow}`);
  
  if (!isWithinWindow) {
    const startDiff = (startWindow.getTime() - sessionTime.getTime()) / (1000 * 60);
    const endDiff = (endWindow.getTime() - sessionTime.getTime()) / (1000 * 60);
    console.log(`Start window difference: ${startDiff.toFixed(2)} minutes`);
    console.log(`End window difference: ${endDiff.toFixed(2)} minutes`);
  }
  
  // Check all conditions
  console.log(`\n=== Function Query Conditions ===`);
  console.log(`1. line_reminder_scheduled = false: ${session.line_reminder_scheduled === false}`);
  console.log(`2. line_reminder_sent_at IS NULL: ${session.line_reminder_sent_at === null}`);
  console.log(`3. next_session_date IS NOT NULL: ${session.next_session_date !== null}`);
  console.log(`4. user_id IS NOT NULL: ${session.user_id !== null}`);
  console.log(`5. Time within window (25-75 min): ${isWithinWindow}`);
  console.log(`6. Has subordinate (inner join): ${!!session.subordinates}`);
  
  const allConditionsMet = 
    session.line_reminder_scheduled === false &&
    session.line_reminder_sent_at === null &&
    session.next_session_date !== null &&
    session.user_id !== null &&
    isWithinWindow &&
    !!session.subordinates;
    
  console.log(`\nAll conditions met: ${allConditionsMet}`);
}

checkSession().catch(console.error);