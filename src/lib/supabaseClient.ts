import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

if (!supabaseUrl || !supabasePublishableKey || supabasePublishableKey === 'placeholder') {
  console.error("Missing critical Supabase publishable key! Please check your environment variables or Vercel settings.");
}

// Forcefully clear any stale lock in localStorage to prevent tab-freeze race conditions
if (typeof window !== 'undefined') {
  try {
    const projectId = new URL(supabaseUrl).hostname.split('.')[0];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('auth-token') && key.includes('lock')) {
            localStorage.removeItem(key);
        }
    }
  } catch (err) {
    // Ignore
  }
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        lock: async (name, acquireTimeout, fn) => {
            // Bypass Web Locks API to prevent tab-freeze deadlocks & 'steal' errors
            return await fn();
        }
    },
    realtime: {
        params: {
            eventsPerSecond: 40,
        },
        timeout: 30000,
        heartbeatIntervalMs: 15000,
    },
    global: {
        headers: {
            'x-application-name': 'drazba-realtime'
        }
    }
});
