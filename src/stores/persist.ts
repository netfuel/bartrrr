import { supabase } from '@/lib/supabase'
import { showToast } from './toast-store'

/**
 * Standard rejection handler for optimistic store writes.
 * Demo mode (no Supabase client) is silent — local-only writes are the
 * expected behavior there. Real backend failures warn and tell the user.
 */
export function persistError(userMessage: string) {
  return (err: unknown) => {
    if (!supabase) return
    console.warn(`[Bartr] ${userMessage}`, err)
    showToast(
      `${userMessage} — it may not have saved. Check your connection and try again.`,
      'error',
    )
  }
}
