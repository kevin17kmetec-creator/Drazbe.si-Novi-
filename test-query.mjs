import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const p = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const supabase = createClient(p.supabaseUrl, p.supabaseAnonKey);

async function test() {
  const { data, error } = await supabase
    .from('auctions')
    .select('id, seller_id, winner_id, ...users!seller_id(email)')
    .limit(1);
    
  console.log("data with users!...", data, error);
}

test();
