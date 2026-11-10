import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'
import { authPathWithReturn } from '@/lib/auth/redirect'
import { OFFLINE_DEMO } from '@/lib/env'
import { useAuthStore, useUsersStore } from '@/stores'

/**
 * Public demo: no login screen. A visitor who reaches any app route is
 * signed in as the first sample neighbor; /auth/login still lets them switch.
 */
function useDemoAutoSignIn(isAuthenticated: boolean, isLoading: boolean) {
  const shouldSignIn = OFFLINE_DEMO && !isLoading && !isAuthenticated
  useEffect(() => {
    if (!shouldSignIn) return
    const first = useUsersStore.getState().users[0]
    if (!first) return
    const auth = useAuthStore.getState()
    auth.markOnboarded(first.id)
    auth.login(first.id)
  }, [shouldSignIn])
  return shouldSignIn
}

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, currentUser, hasOnboarded, loadError, retryLoad, logout } = useAuth()
  const location = useLocation()
  const demoSigningIn = useDemoAutoSignIn(isAuthenticated, isLoading)

  // Wait for Supabase to restore the session before making auth decisions
  if (isLoading || demoSigningIn) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center" aria-busy="true">
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-4">
          <div className="h-7 w-7 border border-ink border-t-transparent rounded-full animate-spin" aria-hidden="true" />
          <p className="text-label text-muted">Loading…</p>
        </div>
      </div>
    )
  }

  // Signed in, but the profile/data couldn't load (offline, paused backend)
  if (loadError && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4" role="alert">
          <p className="text-base text-ink-2">{loadError}</p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={retryLoad}
              className="pressable inline-flex min-h-[44px] items-center rounded-none bg-ink px-6 text-[15px] font-medium text-cream hover:bg-ink-2"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex min-h-[44px] items-center rounded-full border border-ink px-6 text-[15px] font-medium text-ink hover:bg-ink hover:text-cream"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    // Keep the full destination (path + query + hash) so deep links survive login
    const from = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={authPathWithReturn('/auth/login', from)} replace />
  }

  // Redirect to onboarding only for brand-new users who haven't set a neighborhood
  if (
    currentUser &&
    !hasOnboarded(currentUser.id) &&
    !currentUser.neighborhood &&
    location.pathname !== '/onboarding'
  ) {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
