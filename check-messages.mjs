import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://ltppzfzfyhbxnzczsdba.supabase.co';
const supabaseKey = 'sb_publishable_zf4BJqc3anHFWP3sVUCbcg_H6QGhhCh';
const supabase = createClient(supabaseUrl, supabaseKey);

const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0cHB6ZnpmeWhieG56Y3pzZGJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg2ODczMCwiZXhwIjoyMDkwNDQ0NzMwfQ.ic00bn3JVXo6vIlCMsiPYzzs0AXCVdlyABVRy6YXW2E';
const supabaseAdmin = createClient(supabaseUrl, serviceKey);

async function test() {
  const { data: d1, error: e1 } = await supabaseAdmin.from('messages').delete().eq('conversation_id', 'eb772dbf-eac1-47ee-ad65-27f89915065f');
  console.log("Deleted Msg:", d1, e1);
  
  const { data: d2, error: e2 } = await supabaseAdmin.from('conversations').delete().eq('id', 'eb772dbf-eac1-47ee-ad65-27f89915065f');
  console.log("Deleted Conv:", d2, e2);
}

test();
