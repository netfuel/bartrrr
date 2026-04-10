import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, currentUser, hasOnboarded } = useAuth()
  const location = useLocation()

  // Wait for Supabase to restore the session before making auth decisions
  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-clay border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted">Loading…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/auth/login?returnTo=${encodeURIComponent(location.pathname)}`}
        replace
      />
    )
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
