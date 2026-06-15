import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ltppzfzfyhbxnzczsdba.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0cHB6ZnpmeWhieG56Y3pzZGJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg2ODczMCwiZXhwIjoyMDkwNDQ0NzMwfQ.ic00bn3JVXo6vIlCMsiPYzzs0AXCVdlyABVRy6YXW2E';
const sAdmin = createClient(supabaseUrl, serviceKey);

async function test() {
  const { data: msgs } = await sAdmin.from('messages').select('*').limit(1);
  console.log('msg count:', msgs.length, msgs);
}
test();
