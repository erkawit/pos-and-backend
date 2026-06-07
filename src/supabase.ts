import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Load defaults from Vite environment variables (useful for production deployment on Vercel)
const defaultUrl = ((import.meta as any).env?.VITE_SUPABASE_URL as string) || '';
const defaultAnonKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || '';

let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export function getSupabaseClient(customUrl?: string, customAnonKey?: string): SupabaseClient | null {
  const url = customUrl || defaultUrl;
  const key = customAnonKey || defaultAnonKey;

  if (!url || !key) {
    return null;
  }

  // Reuse client if URL and Key haven't changed
  if (cachedClient && url === lastUrl && key === lastKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    lastUrl = url;
    lastKey = key;
    return cachedClient;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    return null;
  }
}

// Initial default client instance (might be null if keys are not set yet)
export const supabase = getSupabaseClient();
