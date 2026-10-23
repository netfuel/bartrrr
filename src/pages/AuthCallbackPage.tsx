import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { buttonStyles } from '@/components/ui'
import { AuthShell } from '@/components/layout'
import { usePageTitle } from '@/lib/utils'
import { useAuth } from '@/providers/AuthProvider'
import {
  DEFAULT_AFTER_LOGIN,
  completeAuthRedirect,
  consumeReturnTo,
  friendlyAuthError,
  readAuthErrorFromUrl,
} from '@/lib/auth'

/** Give up waiting for a session after this long */
const TIMEOUT_MS = 15_000

/**
 * Landing route for OAuth (Google, Apple) and email-confirmation links.
 * supabase-js exchanges the ?code= for a session on load; this page waits
 * for that and for AuthProvider to load the profile, then routes:
 *   new user (no neighborhood yet) → /onboarding
 *   returning user                 → where they were going, or /browse
 */
export default function AuthCallbackPage() {
  usePageTitle('Logging in')
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, currentUser, hasOnboarded, loadError } = useAuth()
  const [error, setError] = useState<string | null>(() => {
    const fromUrl = readAuthErrorFromUrl()
    return fromUrl ? friendlyAuthError(fromUrl) : null
  })
  const [exchangeDone, setExchangeDone] = useState(false)
  const destination = useRef<string | null>(null)

  // Read the stored destination once (it's single-use)
  if (destination.current === null) {
    destination.current = consumeReturnTo() ?? DEFAULT_AFTER_LOGIN
  }

  useEffect(() => {
    if (error) return
    let cancelled = false
    completeAuthRedirect()
      .then(({ error: exchangeError, hasSession }) => {
        if (cancelled) return
        if (exchangeError) setError(friendlyAuthError(exchangeError))
        else if (!hasSession) setError('That link was already used or is no longer valid. Log in again to get a fresh one.')
        setExchangeDone(true)
      })
      .catch((err) => {
        if (!cancelled) setError(friendlyAuthError(err))
      })
    const timer = setTimeout(() => {
      if (!cancelled) setError((e) => e ?? 'Logging in is taking longer than usual. Check your connection and try again.')
    }, TIMEOUT_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [error])

  useEffect(() => {
    if (!exchangeDone || error || isLoading || !isAuthenticated || !currentUser) return
    const isNewUser = !currentUser.neighborhood && !hasOnboarded(currentUser.id)
    navigate(isNewUser ? '/onboarding' : (destination.current ?? DEFAULT_AFTER_LOGIN), { replace: true })
  }, [exchangeDone, error, isLoading, isAuthenticated, currentUser, hasOnboarded, navigate])

  const shownError = error ?? (exchangeDone ? loadError : null)

  if (shownError) {
    return (
      <AuthShell image="/photo-editorial.jpg" caption={<>Trade, <em>don't buy.</em></>}>
        <div className="mb-10 animate-fade-up">
          <h1 className="text-heading-page text-ink">We couldn't log you in</h1>
        </div>
        <div className="border-t border-ink pt-6 space-y-6 animate-fade-up stagger-1">
          <p role="alert" className="text-base text-ink-2 leading-relaxed">{shownError}</p>
          <Link to="/auth/login" className={buttonStyles({ variant: 'primary', size: 'lg', className: 'w-full' })}>
            Back to log in
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <div className="min-h-[100svh] bg-cream flex items-center justify-center px-4" aria-busy="true">
      <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
        <Loader2 className="h-7 w-7 animate-spin text-clay" strokeWidth={1.25} aria-hidden="true" />
        <p className="text-label text-muted">Logging you in…</p>
      </div>
    </div>
  )
}
