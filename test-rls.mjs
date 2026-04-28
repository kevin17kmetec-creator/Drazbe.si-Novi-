import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://ltppzfzfyhbxnzczsdba.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0cHB6ZnpmeWhieG56Y3pzZGJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg2ODczMCwiZXhwIjoyMDkwNDQ0NzMwfQ.ic00bn3JVXo6vIlCMsiPYzzs0AXCVdlyABVRy6YXW2E');

async function test() {
  const { data, error } = await supabase.rpc('execute_sql', { sql_query: `
    SELECT policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'messages';
  `});
  console.log(data);
}
test();
