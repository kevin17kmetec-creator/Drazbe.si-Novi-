import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ltppzfzfyhbxnzczsdba.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_zf4BJqc3anHFWP3sVUCbcg_H6QGhhCh';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
