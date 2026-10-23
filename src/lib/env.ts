/**
 * Single source of truth for build-time configuration.
 * Every VITE_* variable is public: it ships in the client bundle.
 * Never put a secret (service-role key, OAuth client secret) here.
 */

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
export const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN ?? '').trim()
export const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '').trim()

/**
 * Demo mode: sample users and data plus the "log in as" picker.
 * Must be opted into explicitly with VITE_DEMO_MODE=true; a production
 * build without the flag never contains the picker.
 */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://bartrrr.app').replace(/\/+$/, '')

export const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

/** Env vars the app can't run without (outside demo mode). */
export const MISSING_REQUIRED_ENV: string[] = DEMO_MODE
  ? []
  : [
      !SUPABASE_URL && 'VITE_SUPABASE_URL',
      !SUPABASE_ANON_KEY && 'VITE_SUPABASE_ANON_KEY',
    ].filter((v): v is string => Boolean(v))

export const IS_CONFIGURED = MISSING_REQUIRED_ENV.length === 0
