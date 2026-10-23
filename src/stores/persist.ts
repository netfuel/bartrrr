import { supabase } from '@/lib/supabase'
import { ValidationError } from '@/lib/validation-error'
import { isNetworkError } from '@/lib/auth/errors'
import { showToast } from './toast-store'

/** True when writes go to a backend (false in offline demo mode). */
export const hasBackend = () => Boolean(supabase)

/** A user-presentable reason, when the server gave one we wrote ourselves. */
function reasonFrom(err: unknown): string | null {
  if (err instanceof ValidationError) return err.message.replace(/^[\w.]+: /, '')
  const e = err as { code?: string; message?: string } | null
  // P0001: raised by our own triggers with human-readable text (migration 004)
  if (e?.code === 'P0001' && e.message) return e.message
  return null
}

/**
 * Standard rejection handler for optimistic store writes.
 * Demo mode (no Supabase client) is silent — local-only writes are the
 * expected behavior there. Real backend failures warn and tell the user.
 */
export function persistError(userMessage: string, rollback?: () => void) {
  return (err: unknown) => {
    if (!supabase) return
    console.warn(`[Bartr] ${userMessage}`, err)
    rollback?.()
    const reason = reasonFrom(err)
    showToast(
      reason
        ? `${userMessage}: ${reason}`
        : isNetworkError(err)
          ? `${userMessage}. Check your connection and try again.`
          : `${userMessage}. Please try again.`,
      'error',
    )
  }
}

/**
 * Run a backend write after an optimistic local update. On success the
 * server copy is applied; on failure the local change is rolled back and
 * the user is told. No-op in offline demo mode.
 */
export function persist<T>(
  task: () => Promise<T>,
  opts: { onSuccess?: (result: T) => void; rollback?: () => void; error: string },
): void {
  if (!supabase) return
  task()
    .then((result) => opts.onSuccess?.(result))
    .catch(persistError(opts.error, opts.rollback))
}
