import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://ltppzfzfyhbxnzczsdba.supabase.co';
const supabaseKey = 'sb_publishable_zf4BJqc3anHFWP3sVUCbcg_H6QGhhCh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .limit(1);
    
  console.log("messages schema check:", data, "error:", error);
}

test();
