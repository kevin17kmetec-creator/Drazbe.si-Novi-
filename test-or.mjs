import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const p = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const supabase = createClient(p.supabaseUrl, p.supabaseAnonKey);

async function test() {
  const currentUserId = 'something';
  const { data, error } = await supabase
    .from('auctions')
    .select('id, seller_id, winner_id')
    .or(`seller_id.eq.${currentUserId},winner_id.eq.${currentUserId}`)
    .or(`status.eq.completed,end_time.lte.${new Date().toISOString()}`)
    .limit(1);
    
  console.log("data", data, "error", error);
}

test();
