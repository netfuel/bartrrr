import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { AuthShell } from '@/components/auth'
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
        else if (!hasSession) setError('That sign-in link is invalid or has already been used.')
        setExchangeDone(true)
      })
      .catch((err) => {
        if (!cancelled) setError(friendlyAuthError(err))
      })
    const timer = setTimeout(() => {
      if (!cancelled) setError((e) => e ?? 'Signing in is taking longer than expected. Please try again.')
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
      <AuthShell title="We couldn't sign you in">
        <div className="space-y-4 text-center">
          <p role="alert" className="text-base text-ink-2">{shownError}</p>
          <Link to="/auth/login" className="block">
            <Button variant="primary" size="lg" className="w-full">Back to log in</Button>
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-ink" strokeWidth={1.5} aria-hidden="true" />
        <p className="text-sm text-muted">Signing you in…</p>
      </div>
    </div>
  )
}
