import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const cleanEnv = (val: string | undefined) =>
  (val || '').trim().replace(/^['"]|['"]$/g, '');

const rawUrl = cleanEnv(
  import.meta.env.VITE_SUPABASE_URL as string | undefined,
).replace(/\/+$/, '');
const rawAnonKey = cleanEnv(
  import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
);

const isPlaceholder = (val: string) =>
  !val ||
  val.includes('YOUR_PROJECT_REF') ||
  val.includes('YOUR_SUPABASE_ANON_KEY');

const isSecretKey = (val: string) => val.startsWith('sb_secret_');

const isValidHttpUrl = (val: string) => {
  try {
    const parsed = new URL(val);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

export const isSupabaseConfigured =
  !isPlaceholder(rawUrl) &&
  !isPlaceholder(rawAnonKey) &&
  !isSecretKey(rawAnonKey) &&
  isValidHttpUrl(rawUrl);

export const supabaseConfigError = isSupabaseConfigured
  ? ''
  : isSecretKey(rawAnonKey)
  ? 'Security error: Do not use a Supabase secret key (sb_secret_...) in VITE_SUPABASE_ANON_KEY. Use your public Publishable/anon key instead and rotate the secret key in Supabase.'
  : 'Supabase is not configured in this preview environment. Add VITE_SUPABASE_URL (https://...) and VITE_SUPABASE_ANON_KEY (publishable/anon key) to .env.local and restart the dev server.';

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(rawUrl, rawAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Avoid parsing URL fragments inside Capacitor's https://localhost WebView
        detectSessionInUrl: false,
        storageKey: 'diadikasia_sb_auth_v1',
      },
    })
  : null;
