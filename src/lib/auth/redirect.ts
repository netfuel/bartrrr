/**
 * "Send me back where I was" handling, shared by ProtectedRoute, the auth
 * pages and the OAuth callback.
 *
 * Only same-origin, absolute *paths* are honored. Anything else ("//evil.com",
 * "https://evil.com", "javascript:…") falls back to the default, which closes
 * the open-redirect hole a raw ?returnTo= would leave.
 */

export const DEFAULT_AFTER_LOGIN = '/browse'
const STORAGE_KEY = 'bartrrr:returnTo'

/** Auth screens never make sense as a destination after signing in. */
const AUTH_PATH = /^\/auth(\/|$)/
const PLACEHOLDER_ORIGIN = 'https://bartrrr.invalid'

export function sanitizeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null
  const path = value.trim()
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(path)) return null
  try {
    const url = new URL(path, PLACEHOLDER_ORIGIN)
    if (url.origin !== PLACEHOLDER_ORIGIN) return null
    if (AUTH_PATH.test(url.pathname)) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

/** Build the login/signup URL that brings the user back to `from` afterwards. */
export function authPathWithReturn(
  base: '/auth/login' | '/auth/signup',
  from?: string | null,
): string {
  const safe = sanitizeReturnTo(from)
  return safe && safe !== DEFAULT_AFTER_LOGIN
    ? `${base}?returnTo=${encodeURIComponent(safe)}`
    : base
}

/**
 * OAuth and email links leave the SPA and come back to /auth/callback.
 * The destination survives the round trip in sessionStorage (same tab).
 * It is deliberately not put in the redirect URL: Supabase matches
 * redirect URLs against an allow-list, and query strings make that brittle.
 */
export function rememberReturnTo(value: string | null | undefined): void {
  const safe = sanitizeReturnTo(value)
  try {
    if (safe) sessionStorage.setItem(STORAGE_KEY, safe)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage blocked: we'll fall back to the default destination */
  }
}

export function consumeReturnTo(): string | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY)
    sessionStorage.removeItem(STORAGE_KEY)
    return sanitizeReturnTo(value)
  } catch {
    return null
  }
}

/** Absolute URL for Supabase redirectTo / emailRedirectTo. */
export function authRedirectUrl(path: '/auth/callback' | '/auth/reset-password'): string {
  return new URL(path, window.location.origin).toString()
}
