/**
 * Self-service account deletion (Settings → Delete account).
 *
 * 1. Confirm it's them: email users type their password again
 *    (confirmWithPassword), Google and Apple users go through their provider
 *    once more and come back to /settings?confirm=delete (startOAuthConfirm,
 *    then readOAuthConfirm). The server enforces this too: since migration
 *    013, delete_my_account() refuses unless this session signed in within
 *    the last 10 minutes (the newest `amr` timestamp in the access token).
 * 2. Call public.delete_my_account() (migrations 010 and 013), which runs the
 *    operator deletion from migration 007 for the signed-in neighbor only.
 *    If it fails, nothing has changed.
 * 3. Then remove the neighbor's files from listing-photos/<user id>/
 *    (listing photos, and an avatar if one was uploaded there). Supabase
 *    blocks deleting storage files from SQL, so the browser does it with the
 *    access token it still holds: Storage has no foreign key to auth.users,
 *    and the owner-only policies (008) compare the folder with the token's
 *    sub. It's best effort: the account is already gone, so a failure is
 *    logged, never shown. Leftover folders are swept by the operator
 *    (DEPLOY.md, "Leftover photos").
 *
 * Offline demo mode has no backend, and demo accounts against a real
 * project are shared, so in demo mode nothing is deleted: the confirm step
 * is shown (any password works; "Confirm with Google" comes straight back)
 * and the caller just logs out.
 */
import { supabase } from '@/lib/supabase'
import { DEMO_MODE } from '@/lib/env'
import { PHOTO_BUCKET } from '@/lib/photos'
import { isNetworkError } from '@/lib/auth/errors'
import { OAUTH_PROVIDERS, type OAuthProviderConfig } from '@/lib/auth/providers'
import { signInWithProvider } from '@/lib/auth/actions'

export type AccountDeletionErrorKind =
  /** Couldn't reach Supabase */
  | 'network'
  /** No session, or the token expired */
  | 'session'
  /** The sign-in is older than 10 minutes: confirm it's you again */
  | 'reauth'
  /** The password typed in the dialog doesn't match */
  | 'password'
  /** Too many password tries */
  | 'rate_limited'
  | 'server'

export class AccountDeletionError extends Error {
  readonly kind: AccountDeletionErrorKind
  constructor(kind: AccountDeletionErrorKind, cause?: unknown) {
    super(`Account deletion failed (${kind})`)
    this.kind = kind
    this.cause = cause
  }
}

/** True when deleting only signs out locally (demo data is never removed). */
export const ACCOUNT_DELETION_IS_DEMO = DEMO_MODE || !supabase

/** Same window as delete_my_account() in migration 013. */
export const REAUTH_WINDOW_SECONDS = 10 * 60

/** Where Google and Apple send people back to after confirming. */
export const CONFIRM_RETURN_PATH = '/settings?confirm=delete'

/** How each person confirms it's them before deleting. */
export type ReauthMethod =
  | { kind: 'password'; email: string }
  | { kind: 'oauth'; provider: OAuthProviderConfig }

/** Demo: sample neighbors who "signed up with Google". Everyone else uses a password. */
const DEMO_OAUTH_USERS: Record<string, OAuthProviderConfig['id']> = { 'user-002': 'google' }

function providerConfig(id: string): OAuthProviderConfig | undefined {
  return OAUTH_PROVIDERS.find((p) => p.id === id)
}

/**
 * Password if the account has an email + password sign-in, otherwise the
 * Google or Apple account it signs in with. Null when there's no session.
 */
export async function getReauthMethod(userId: string): Promise<ReauthMethod | null> {
  if (ACCOUNT_DELETION_IS_DEMO || !supabase) {
    const oauth = providerConfig(DEMO_OAUTH_USERS[userId] ?? '')
    return oauth ? { kind: 'oauth', provider: oauth } : { kind: 'password', email: '' }
  }
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user || user.id !== userId) return null
  const fromMeta = (user.app_metadata?.providers as string[] | undefined) ?? []
  const providers = new Set([...(user.identities ?? []).map((i) => i.provider), ...fromMeta])
  if (user.app_metadata?.provider) providers.add(String(user.app_metadata.provider))

  if (providers.has('email') && user.email) return { kind: 'password', email: user.email }
  const oauth = OAUTH_PROVIDERS.find((p) => providers.has(p.id))
  if (oauth) return { kind: 'oauth', provider: oauth }
  return user.email ? { kind: 'password', email: user.email } : null
}

/** Base64url JWT payload, or null. */
function jwtPayload(token: string | undefined): Record<string, unknown> | null {
  try {
    const part = token?.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')
    return JSON.parse(atob(b64)) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * When this session last proved who it is, in seconds since the epoch, read
 * the same way as migration 013: the newest `amr` timestamp in the access
 * token (unchanged by token refreshes), else the user's last_sign_in_at.
 */
export async function sessionSignedInAt(): Promise<number | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (!session) return null
  const amr = jwtPayload(session.access_token)?.amr
  if (Array.isArray(amr)) {
    const times = amr
      .filter((e): e is { method?: unknown; timestamp: number } =>
        typeof e === 'object' && e !== null && typeof (e as { timestamp?: unknown }).timestamp === 'number')
      .filter((e) => e.method !== 'token_refresh')
      .map((e) => e.timestamp)
    if (times.length > 0) return Math.max(...times)
  }
  const last = session.user.last_sign_in_at ? Date.parse(session.user.last_sign_in_at) : NaN
  return Number.isFinite(last) ? Math.floor(last / 1000) : null
}

/** True when the server would accept a deletion now (with a minute to spare). */
async function sessionIsFresh(): Promise<boolean> {
  const at = await sessionSignedInAt()
  return at !== null && Date.now() / 1000 - at < REAUTH_WINDOW_SECONDS - 60
}

/**
 * Email users: sign in again with the password typed in the dialog. This
 * starts a new session for the same account, which is what makes the
 * server accept the deletion. Throws AccountDeletionError.
 */
export async function confirmWithPassword(email: string, password: string): Promise<void> {
  if (!password) throw new AccountDeletionError('password')
  if (ACCOUNT_DELETION_IS_DEMO || !supabase) return
  let error: unknown
  try {
    ;({ error } = await supabase.auth.signInWithPassword({ email, password }))
  } catch (err) {
    error = err
  }
  if (!error) return
  const e = error as { code?: string; status?: number; message?: string }
  if (isNetworkError(error) || navigator.onLine === false) throw new AccountDeletionError('network', error)
  if (e.code === 'invalid_credentials' || (e.status === 400 && !e.code)) throw new AccountDeletionError('password', error)
  if (e.status === 429 || e.code === 'over_request_rate_limit') throw new AccountDeletionError('rate_limited', error)
  throw new AccountDeletionError('server', error)
}

const PENDING_KEY = 'bartrrr:confirmDelete'
const PENDING_MAX_AGE_MS = 60 * 60 * 1000

/**
 * Google and Apple users: go through the provider once more. Remembers who
 * started it (same tab), then redirects; the provider comes back through
 * /auth/callback to CONFIRM_RETURN_PATH. In demo mode nothing leaves the
 * app: returns 'demo' and the caller goes to CONFIRM_RETURN_PATH itself.
 */
export async function startOAuthConfirm(
  provider: OAuthProviderConfig,
  userId: string,
): Promise<'redirecting' | 'demo'> {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ userId, at: Date.now() }))
  } catch {
    // Storage blocked: readOAuthConfirm falls back to checking the session
  }
  if (ACCOUNT_DELETION_IS_DEMO || !supabase) return 'demo'
  try {
    await signInWithProvider(provider, CONFIRM_RETURN_PATH)
  } catch (err) {
    if (isNetworkError(err)) throw new AccountDeletionError('network', err)
    throw new AccountDeletionError('server', err)
  }
  return 'redirecting'
}

export type OAuthConfirmResult =
  /** Back from the provider with a fresh sign-in to the same account */
  | 'confirmed'
  /** Came back signed in to a different account: nothing to confirm */
  | 'other_account'
  /** Came back, but the sign-in isn't fresh (canceled, or too long ago) */
  | 'stale'

/** On /settings?confirm=delete: did the provider round trip work? Single use. */
export async function readOAuthConfirm(userId: string): Promise<OAuthConfirmResult> {
  let pending: { userId?: string; at?: number } | null = null
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    sessionStorage.removeItem(PENDING_KEY)
    pending = raw ? (JSON.parse(raw) as { userId?: string; at?: number }) : null
  } catch {
    pending = null
  }
  if (pending && typeof pending.at === 'number' && Date.now() - pending.at > PENDING_MAX_AGE_MS) pending = null
  if (pending?.userId && pending.userId !== userId) return 'other_account'
  if (ACCOUNT_DELETION_IS_DEMO || !supabase) return pending ? 'confirmed' : 'stale'
  return (await sessionIsFresh()) ? 'confirmed' : 'stale'
}

const LIST_PAGE = 100
const MAX_DEPTH = 3
/** Don't keep the goodbye page waiting on a stalled connection */
const PHOTO_CLEANUP_TIMEOUT_MS = 20_000

/** Every file path under <prefix>, following subfolders a few levels deep. */
async function listFiles(prefix: string, depth = 0): Promise<string[]> {
  if (!supabase) return []
  const bucket = supabase.storage.from(PHOTO_BUCKET)
  const files: string[] = []
  for (let offset = 0; ; offset += LIST_PAGE) {
    const { data, error } = await bucket.list(prefix, { limit: LIST_PAGE, offset })
    if (error) throw error
    for (const entry of data ?? []) {
      const path = `${prefix}/${entry.name}`
      // Folders come back without an id
      if (entry.id) files.push(path)
      else if (depth < MAX_DEPTH) files.push(...(await listFiles(path, depth + 1)))
    }
    if (!data || data.length < LIST_PAGE) break
  }
  return files
}

/**
 * Best effort: remove everything in the neighbor's photo folder. Never
 * throws. Returns how many files couldn't be removed (for the log).
 */
export async function deleteOwnPhotos(userId: string): Promise<number> {
  if (!supabase) return 0
  let paths: string[] = []
  try {
    paths = await listFiles(userId)
    const bucket = supabase.storage.from(PHOTO_BUCKET)
    let failed = 0
    for (let i = 0; i < paths.length; i += LIST_PAGE) {
      const batch = paths.slice(i, i + LIST_PAGE)
      const { data, error } = await bucket.remove(batch)
      if (error) failed += batch.length
      else failed += batch.length - (data?.length ?? 0)
    }
    if (failed > 0) {
      console.warn(`[Bartrrr] ${failed} of ${paths.length} photos weren't removed after account deletion; the operator sweep will remove them`)
    }
    return failed
  } catch (err) {
    console.warn('[Bartrrr] Couldn’t remove photos after account deletion; the operator sweep will remove them', err)
    return Math.max(paths.length, 1)
  }
}

/** deleteOwnPhotos, but give up waiting after a while (the files stay for the sweep). */
async function deleteOwnPhotosWithin(userId: string, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), ms)
  })
  const result = await Promise.race([deleteOwnPhotos(userId), timeout])
  clearTimeout(timer)
  if (result === 'timeout') {
    console.warn('[Bartrrr] Photo removal after account deletion is taking too long; moving on (the operator sweep will remove what’s left)')
  }
}

/** Stop this browser's push subscription (the server row is already gone). */
async function dropBrowserPush(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = await reg?.pushManager.getSubscription()
    await sub?.unsubscribe()
  } catch {
    // Harmless: the server no longer has an endpoint to send to
  }
}

/**
 * Delete the signed-in neighbor's account, then their photos. Resolves once
 * the server has deleted the account; the caller then calls
 * forgetDeletedSession() and logout(). Throws AccountDeletionError only if
 * the account step fails, in which case nothing has changed.
 */
export async function deleteMyAccount(userId: string): Promise<void> {
  if (ACCOUNT_DELETION_IS_DEMO || !supabase) return

  let error: unknown
  try {
    ;({ error } = await supabase.rpc('delete_my_account'))
  } catch (err) {
    error = err
  }
  if (error) {
    console.error('[Bartrrr] delete_my_account failed', error)
    const e = error as { code?: string; message?: string; hint?: string }
    const msg = e.message ?? ''
    if (
      isNetworkError(error) ||
      navigator.onLine === false ||
      /Failed to fetch|NetworkError|Load failed/.test(msg)
    ) {
      throw new AccountDeletionError('network', error)
    }
    // 28000 from 013: the sign-in is more than 10 minutes old
    if (e.code === '28000' || e.hint === 'reauth_required') {
      throw new AccountDeletionError('reauth', error)
    }
    // 42501: no session (raised by the function), PGRST301/303: expired JWT
    if (e.code === '42501' || e.code === 'PGRST301' || e.code === 'PGRST303') {
      throw new AccountDeletionError('session', error)
    }
    throw new AccountDeletionError('server', error)
  }

  // The account is gone. From here on, problems are logged, not shown.
  await deleteOwnPhotosWithin(userId, PHOTO_CLEANUP_TIMEOUT_MS)
}

/**
 * After a successful deletion: forget the session on this device. Deleting
 * the sign-in already ended its sessions on the server, so local scope is
 * enough. The caller still runs the app's logout() to clear the stores.
 */
export async function forgetDeletedSession(): Promise<void> {
  if (ACCOUNT_DELETION_IS_DEMO || !supabase) return
  await dropBrowserPush()
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
}
