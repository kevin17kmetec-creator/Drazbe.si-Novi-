import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://larxcbeaquxussbfkhit.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_EvQS2qHckKtEFVd5lqGdeQ_zepWLio8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
