import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { HAS_SUPABASE, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env'

/**
 * Null only in offline demo mode (VITE_DEMO_MODE=true with no Supabase env).
 * Outside demo mode, main.tsx refuses to boot without credentials.
 *
 * PKCE is the recommended flow for browser apps: OAuth, email confirmation
 * and password-recovery links come back as ?code=… which the client
 * exchanges on load (detectSessionInUrl).
 */
export const supabase = HAS_SUPABASE
  ? createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
