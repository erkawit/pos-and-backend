import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Load defaults from Vite environment variables (useful for production deployment on Vercel)
const rawUrl = ((import.meta as any).env?.VITE_SUPABASE_URL as string) || '';
const rawAnonKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || '';

const defaultUrl = rawUrl.includes('your-project-id') ? '' : rawUrl;
const defaultAnonKey = rawAnonKey.includes('your-anon-public-key') ? '' : rawAnonKey;

let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export function getSupabaseClient(customUrl?: string, customAnonKey?: string): SupabaseClient | null {
  let url = customUrl || defaultUrl;
  let key = customAnonKey || defaultAnonKey;

  // Filter out custom placeholder inputs from files
  if (url.includes('https://gstlprqiihywumsydhhl.supabase.co')) url = '';
  if (key.includes('sb_publishable___fo8taW3ECQgR-iIG6vew_JZ8Bwooy')) key = '';
  // if (url.includes('your-project-id')) url = '';
  // if (key.includes('your-anon-public-key')) key = '';

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
