import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ltppzfzfyhbxnzczsdba.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0cHB6ZnpmeWhieG56Y3pzZGJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg2ODczMCwiZXhwIjoyMDkwNDQ0NzMwfQ.ic00bn3JVXo6vIlCMsiPYzzs0AXCVdlyABVRy6YXW2E';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.rpc('execute_sql', { sql_query: `
    alter publication supabase_realtime add table messages;
  `});
  console.log("Migration:", data, error);
}

test();
