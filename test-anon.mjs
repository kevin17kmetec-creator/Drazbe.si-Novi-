import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ltppzfzfyhbxnzczsdba.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0cHB6ZnpmeWhieG56Y3pzZGJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4Njg3MzAsImV4cCI6MjA5MDQ0NDczMH0.b6u5a8uR9tM1_D_-i3DveO5T44X-M8Nn4E2S1Wv8-t4';

const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0cHB6ZnpmeWhieG56Y3pzZGJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg2ODczMCwiZXhwIjoyMDkwNDQ0NzMwfQ.ic00bn3JVXo6vIlCMsiPYzzs0AXCVdlyABVRy6YXW2E';

const sAdmin = createClient(supabaseUrl, serviceKey);

async function test() {
  const { data: messages } = await sAdmin.from('messages').select('*').eq('is_read', false).limit(1);
  if (!messages || messages.length === 0) return console.log('no unread');
  const msg = messages[0];
  console.log('Got msg to update', msg);

  // Authenticate as a fake user or just trying to use the anon key will fail RLS if no policy
  const sAnon = createClient(supabaseUrl, supabaseAnonKey);
  // Without sign in, it's just anon. RLS won't let us update anything unless auth.uid() == receiver_id.
  const { data: ud, error: ue } = await sAnon.from('messages').update({ is_read: true }).eq('id', msg.id);
  console.log('Update Error with Anon:', ue);
}
test();
