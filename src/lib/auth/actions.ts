/**
 * Auth actions for the Login / Signup / password screens.
 * Session wiring (profile load, realtime, stores) lives in AuthProvider,
 * which reacts to the auth events these calls trigger.
 */

import type { OAuthProviderConfig } from './providers'
import { authRedirectUrl, rememberReturnTo } from './redirect'
import { supabase } from '@/lib/supabase'
import {
  emailSchema,
  loginSchema,
  parseOrThrow,
  passwordSchema,
  signupSchema,
} from '@/lib/validation'

function client() {
  if (!supabase) {
    throw new Error('Sign-in is unavailable: Supabase is not configured.')
  }
  return supabase
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const input = parseOrThrow(loginSchema, { email, password })
  const { error } = await client().auth.signInWithPassword(input)
  if (error) throw error
}

/**
 * Create an email + password account. With email confirmation on (the
 * production setting) there is no session yet: the user must click the
 * link we send, which lands on /auth/callback.
 */
export async function signUpWithEmail(params: {
  displayName: string
  email: string
  password: string
  returnTo?: string | null
}): Promise<{ needsEmailConfirmation: boolean }> {
  const input = parseOrThrow(signupSchema, params)
  rememberReturnTo(params.returnTo)
  const { data, error } = await client().auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: authRedirectUrl('/auth/callback'),
      // Read by the on_auth_user_created trigger to name the profile
      data: { full_name: input.displayName },
    },
  })
  if (error) throw error
  // Supabase returns a user with no identities (and no error) when the email
  // is already registered, to avoid leaking which emails have accounts.
  return { needsEmailConfirmation: !data.session }
}

/** Redirects the browser to the provider. Resolves only if that fails. */
export async function signInWithProvider(
  provider: OAuthProviderConfig,
  returnTo?: string | null,
): Promise<void> {
  rememberReturnTo(returnTo)
  const { error } = await client().auth.signInWithOAuth({
    provider: provider.id,
    options: {
      redirectTo: authRedirectUrl('/auth/callback'),
      scopes: provider.scopes,
      queryParams: provider.queryParams,
    },
  })
  if (error) throw error
}

/** Always resolves the same way, whether or not the email has an account. */
export async function requestPasswordReset(email: string): Promise<void> {
  const checked = parseOrThrow(emailSchema, email)
  const { error } = await client().auth.resetPasswordForEmail(checked, {
    redirectTo: authRedirectUrl('/auth/reset-password'),
  })
  // Rate-limit errors are worth surfacing; "user not found" never happens
  // (Supabase doesn't reveal it) but would be swallowed here anyway.
  if (error && error.status === 429) throw error
  if (error && error.status !== 400 && error.status !== 404) throw error
}

export async function updatePassword(password: string): Promise<void> {
  const checked = parseOrThrow(passwordSchema, password)
  const { error } = await client().auth.updateUser({ password: checked })
  if (error) throw error
}

/**
 * Wait for supabase-js to finish reading the URL (PKCE code exchange) and
 * report whether that produced an error. Safe to call repeatedly.
 */
export async function completeAuthRedirect(): Promise<{ error: unknown | null; hasSession: boolean }> {
  const db = client()
  const { error } = await db.auth.initialize()
  const { data } = await db.auth.getSession()
  return { error: error ?? null, hasSession: Boolean(data.session) }
}

/**
 * Errors the provider or Supabase bounced back in the URL
 * (?error=access_denied&error_description=… or in the #hash).
 */
export function readAuthErrorFromUrl(): string | null {
  const sources = [
    new URLSearchParams(window.location.search),
    new URLSearchParams(window.location.hash.replace(/^#/, '')),
  ]
  for (const params of sources) {
    const err = params.get('error_description') || params.get('error') || params.get('error_code')
    if (err) return err
  }
  return null
}
