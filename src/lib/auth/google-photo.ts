/**
 * The Google profile photo a neighbor signed in with (T-06).
 *
 * New Google accounts start with their Google picture as their Bartrrr
 * profile photo (profileSeedFromSession in AuthProvider). Replacing or
 * removing it used to be one-way; Settings reads the picture back from the
 * auth session so "Use my Google photo" can restore it.
 *
 * Offline demo mode has no session: sample neighbors listed in
 * DEMO_OAUTH_USERS "signed up with Google" (Maria; the same convention the
 * account-deletion flow uses) and DEMO_GOOGLE_PHOTOS holds their picture.
 */
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { DEMO_MODE } from '@/lib/env'
import type { OAuthProviderConfig } from './providers'

/** Demo: sample neighbors who "signed up with Google". Everyone else uses a password. */
export const DEMO_OAUTH_USERS: Record<string, OAuthProviderConfig['id']> = { 'user-002': 'google' }

/** Demo: their Google picture (Maria's sample photo, which she starts with). */
export const DEMO_GOOGLE_PHOTOS: Record<string, string> = {
  'user-002': 'https://picsum.photos/seed/maria/200/200',
}

/**
 * The provider photo in OAuth metadata: Google sends `picture` and Supabase
 * copies it to `avatar_url`. Only https links count (the profile schema
 * takes nothing else).
 */
export function photoFromMetadata(meta: unknown): string | undefined {
  if (!meta || typeof meta !== 'object') return undefined
  const m = meta as Record<string, unknown>
  for (const v of [m.avatar_url, m.picture]) {
    if (typeof v === 'string' && /^https:\/\/\S+$/i.test(v.trim())) return v.trim()
  }
  return undefined
}

/**
 * The Google picture for a signed-in user, or undefined when they don't
 * sign in with Google or Google has no picture for them. The Google
 * identity's own data wins: user_metadata follows whichever provider
 * signed in last.
 */
export function googlePhotoFromUser(
  user: Pick<User, 'identities' | 'user_metadata' | 'app_metadata'>,
): string | undefined {
  const identity = user.identities?.find((i) => i.provider === 'google')
  const fromIdentity = photoFromMetadata(identity?.identity_data)
  if (fromIdentity) return fromIdentity
  const providers = [
    ...((user.app_metadata?.providers as string[] | undefined) ?? []),
    String(user.app_metadata?.provider ?? ''),
  ]
  return identity || providers.includes('google') ? photoFromMetadata(user.user_metadata) : undefined
}

/** The Google picture for this neighbor, read from the current session. */
export async function getGooglePhotoUrl(userId: string): Promise<string | undefined> {
  if (!supabase) {
    return DEMO_MODE && DEMO_OAUTH_USERS[userId] === 'google' ? DEMO_GOOGLE_PHOTOS[userId] : undefined
  }
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user || user.id !== userId) return undefined
  return googlePhotoFromUser(user)
}
