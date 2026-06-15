import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ltppzfzfyhbxnzczsdba.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0cHB6ZnpmeWhieG56Y3pzZGJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg2ODczMCwiZXhwIjoyMDkwNDQ0NzMwfQ.ic00bn3JVXo6vIlCMsiPYzzs0AXCVdlyABVRy6YXW2E';
const sAdmin = createClient(supabaseUrl, serviceKey);

async function test() {
  // get a message that is false
  const { data: msgs } = await sAdmin.from('messages').select('*').eq('is_read', false).limit(1);
  if (!msgs || msgs.length === 0) return console.log('no messages');
  const msg = msgs[0];
  console.log('msg to update', msg);
  
  // get conversation to find receiver
  const { data: conv } = await sAdmin.from('conversations').select('*').eq('id', msg.conversation_id).single();
  const receiverId = conv.participant_one === msg.sender_id ? conv.participant_two : conv.participant_one;
  
  // sign in as receiver (can't natively without pass, but i can use admin to generate user jwt or just use anon API but since I need auth... wait)
}
test();
