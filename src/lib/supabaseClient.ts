import { createClient } from '@supabase/supabase-js';

// These variables must be in your .env file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase credentials missing! Check your .env file.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Helper to get the current user's role from metadata
 * This is useful for your protected routes later.
 */
export const getUserRole = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.user_metadata?.role || null;
};