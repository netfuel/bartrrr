/**
 * Self-service account deletion (Settings → Delete account).
 *
 * 1. Remove the neighbor's files from listing-photos/<user id>/ (listing
 *    photos, and an avatar if one was uploaded there). Supabase blocks
 *    deleting storage files from SQL, so this has to happen in the browser,
 *    while the session can still pass the owner-only storage policies
 *    (migration 008). It's best effort: a failure is logged and deletion
 *    goes ahead. Leftover files are swept by the operator (DEPLOY.md).
 * 2. Call public.delete_my_account() (migration 010), which runs the
 *    operator deletion from migration 007 for the signed-in neighbor only.
 *
 * Offline demo mode has no backend, and demo accounts against a real
 * project are shared, so in demo mode nothing is deleted: the caller just
 * logs out.
 */
import { supabase } from '@/lib/supabase'
import { DEMO_MODE } from '@/lib/env'
import { PHOTO_BUCKET } from '@/lib/photos'
import { isNetworkError } from '@/lib/auth/errors'

export class AccountDeletionError extends Error {
  readonly kind: 'network' | 'session' | 'server'
  constructor(kind: AccountDeletionError['kind'], cause?: unknown) {
    super(`Account deletion failed (${kind})`)
    this.kind = kind
    this.cause = cause
  }
}

/** True when deleting only signs out locally (demo data is never removed). */
export const ACCOUNT_DELETION_IS_DEMO = DEMO_MODE || !supabase

const LIST_PAGE = 100
const MAX_DEPTH = 3

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
      console.warn(`[Bartrrr] ${failed} of ${paths.length} photos weren't removed; continuing with account deletion`)
    }
    return failed
  } catch (err) {
    console.warn('[Bartrrr] Couldn’t remove photos; continuing with account deletion', err)
    return Math.max(paths.length, 1)
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
 * Delete the signed-in neighbor's account. Resolves once the server has
 * deleted it; the caller then calls forgetDeletedSession() and logout().
 * Throws AccountDeletionError.
 */
export async function deleteMyAccount(userId: string): Promise<void> {
  if (ACCOUNT_DELETION_IS_DEMO || !supabase) return

  await deleteOwnPhotos(userId)

  let error: unknown
  try {
    ;({ error } = await supabase.rpc('delete_my_account'))
  } catch (err) {
    error = err
  }
  if (error) {
    console.error('[Bartrrr] delete_my_account failed', error)
    const e = error as { code?: string; message?: string }
    const msg = e.message ?? ''
    if (
      isNetworkError(error) ||
      navigator.onLine === false ||
      /Failed to fetch|NetworkError|Load failed/.test(msg)
    ) {
      throw new AccountDeletionError('network', error)
    }
    // 42501: no session (raised by the function), PGRST301/303: expired JWT
    if (e.code === '42501' || e.code === 'PGRST301' || e.code === 'PGRST303') {
      throw new AccountDeletionError('session', error)
    }
    throw new AccountDeletionError('server', error)
  }
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
