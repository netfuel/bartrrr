import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'

export function ProtectedRoute() {
  const { isAuthenticated, currentUser, hasOnboarded } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/auth/login?returnTo=${encodeURIComponent(location.pathname)}`}
        replace
      />
    )
  }

  // Redirect to onboarding for new users (skip if already on /onboarding)
  if (
    currentUser &&
    !hasOnboarded(currentUser.id) &&
    location.pathname !== '/onboarding'
  ) {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
