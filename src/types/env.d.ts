/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_MAPBOX_TOKEN?: string
  readonly VITE_VAPID_PUBLIC_KEY?: string
  /** "true" enables sample data and the "log in as" demo picker. Never set in production. */
  readonly VITE_DEMO_MODE?: string
  /** Demo mode + Supabase only: shared password of the seeded *@bartrrr.demo accounts */
  readonly VITE_DEMO_PASSWORD?: string
  /** Comma-separated OAuth providers to show, e.g. "google,apple". Defaults to all configured. */
  readonly VITE_AUTH_PROVIDERS?: string
  /** Canonical public origin, e.g. https://bartrrr.app */
  readonly VITE_SITE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
