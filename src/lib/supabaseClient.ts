import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing critical Supabase environment variables! Please check your Vercel settings.");
}

// Forcefully clear any stale lock in localStorage to prevent 5000ms race conditions
if (typeof window !== 'undefined') {
  try {
    const projectId = new URL(supabaseUrl).hostname.split('.')[0];
    const lockKey = `sb-${projectId}-auth-token-code-verifier`;
    const fallbackLock = `sb-${projectId}-auth-token`;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('auth-token') && key.includes('lock')) {
            localStorage.removeItem(key);
        }
    }
  } catch (err) {
    console.warn('Could not clear auth locks:', err);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        lock: async (name, acquireTimeout, fn) => {
            // Bypass Web Locks API to prevent tab-freeze deadlocks & 'steal' errors
            return await fn();
        }
    }
});
