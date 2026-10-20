import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/types/database.types';

export const hasBackend = Boolean(import.meta.env.VITE_SUPABASE_URL);

/** The admin's client: unlike the guests' one, it keeps the session between visits. */
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL || 'http://localhost',
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'missing',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'wi-admin-auth',
    },
  },
);
