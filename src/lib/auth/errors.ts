import { isAuthError } from '@supabase/supabase-js'

/**
 * Turn a Supabase Auth error (or an OAuth error bounced back in the URL)
 * into something a neighbor can act on. Never leak raw server text.
 */
export function friendlyAuthError(err: unknown): string {
  const code = isAuthError(err) ? err.code : undefined
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  const m = message.toLowerCase()

  if (isNetworkError(err)) {
    return "We couldn't reach Bartrrr. Check your connection and try again."
  }
  switch (code) {
    case 'invalid_credentials':
      return "That email and password don't match. Try again or reset your password."
    case 'email_not_confirmed':
      return 'Check your inbox and confirm your email before logging in.'
    case 'user_already_exists':
    case 'email_exists':
      return 'An account with that email already exists. Try logging in instead.'
    case 'weak_password':
      return 'Choose a stronger password: at least 8 characters with letters and numbers.'
    case 'same_password':
      return 'Your new password must be different from your old one.'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many tries in a row. Wait a minute, then try again.'
    case 'provider_disabled':
    case 'oauth_provider_not_supported':
      return "That way of logging in isn't available right now. Use your email and password instead."
    case 'flow_state_expired':
    case 'flow_state_not_found':
    case 'bad_code_verifier':
      return 'That link expired or was opened in a different browser. Start again from this browser.'
    case 'otp_expired':
      return 'That link has expired. Request a new one.'
    case 'signup_disabled':
      return "New accounts are paused right now. Check back soon."
  }
  if (m.includes('access_denied') || m.includes('cancel')) {
    return "Login was canceled. Try again whenever you're ready."
  }
  if (m.includes('expired')) return 'That link has expired. Request a new one.'
  return 'Something went wrong on our end. Try again in a moment.'
}

/** A fetch that never reached Supabase (paused project, offline, DNS). */
export function isNetworkError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'AuthRetryableFetchError' ||
      err.message.includes('Failed to fetch') ||
      err.message.includes('NetworkError') ||
      err.message.includes('Load failed'))
  )
}
