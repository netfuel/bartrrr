import type { Provider } from '@supabase/supabase-js'

/**
 * OAuth providers offered on Login and Signup.
 *
 * To add one (e.g. GitHub):
 *   1. enable it in Supabase (dashboard + [auth.external.github] in config.toml)
 *   2. add an entry below; the buttons render from this list.
 * VITE_AUTH_PROVIDERS="google,apple" can narrow the list per environment
 * (e.g. while Apple review is pending).
 */
export interface OAuthProviderConfig {
  id: Provider
  /** Brand name used in the button: "Continue with {label}" */
  label: string
  /** Extra provider scopes (space-separated) */
  scopes?: string
  /** Extra query params for the provider's consent screen */
  queryParams?: Record<string, string>
}

export const OAUTH_PROVIDERS: OAuthProviderConfig[] = [
  {
    id: 'google',
    label: 'Google',
    // Always show the account chooser so people with several Gmail
    // accounts can pick the right one.
    queryParams: { prompt: 'select_account' },
  },
  {
    id: 'apple',
    label: 'Apple',
    scopes: 'name email',
  },
]

export function getEnabledProviders(): OAuthProviderConfig[] {
  const raw = import.meta.env.VITE_AUTH_PROVIDERS
  if (!raw) return OAUTH_PROVIDERS
  const allowed = new Set(
    raw
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean),
  )
  return OAUTH_PROVIDERS.filter((p) => allowed.has(p.id))
}
