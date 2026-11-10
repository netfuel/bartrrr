import { Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { PageShell, ProtectedRoute } from '@/components/layout'
import { Toaster } from '@/components/ui'
import { ErrorBoundary } from '@/components/system/ErrorBoundary'
import { RouteEffects } from '@/components/system/RouteEffects'
import { lazyWithRetry } from '@/components/system/chunk-reload'

// Route-level code splitting: each page loads on demand, keeping heavy
// deps (maplibre-gl on Browse, gsap on Landing, confetti on Agreements)
// out of the initial bundle. A page that fails to load (offline) loads
// again on the error screen's Try again or when the connection returns.
const LandingPage = lazyWithRetry(() => import('@/pages/LandingPage'))
const BrowsePage = lazyWithRetry(() => import('@/pages/BrowsePage'))
const ListingDetailPage = lazyWithRetry(() => import('@/pages/ListingDetailPage'))
const CreateListingPage = lazyWithRetry(() => import('@/pages/CreateListingPage'))
const OffersInboxPage = lazyWithRetry(() => import('@/pages/OffersInboxPage'))
const OfferThreadPage = lazyWithRetry(() => import('@/pages/OfferThreadPage'))
const AgreementsPage = lazyWithRetry(() => import('@/pages/AgreementsPage'))
const AgreementDetailPage = lazyWithRetry(() => import('@/pages/AgreementDetailPage'))
const ProfilePage = lazyWithRetry(() => import('@/pages/ProfilePage'))
const SettingsPage = lazyWithRetry(() => import('@/pages/SettingsPage'))
const LoginPage = lazyWithRetry(() => import('@/pages/LoginPage'))
const SignupPage = lazyWithRetry(() => import('@/pages/SignupPage'))
const AuthCallbackPage = lazyWithRetry(() => import('@/pages/AuthCallbackPage'))
const ForgotPasswordPage = lazyWithRetry(() => import('@/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazyWithRetry(() => import('@/pages/ResetPasswordPage'))
const DashboardPage = lazyWithRetry(() => import('@/pages/DashboardPage'))
const EditListingPage = lazyWithRetry(() => import('@/pages/EditListingPage'))
const OnboardingPage = lazyWithRetry(() => import('@/pages/OnboardingPage'))
const ActivityFeedPage = lazyWithRetry(() => import('@/pages/ActivityFeedPage'))
const NotFoundPage = lazyWithRetry(() => import('@/pages/NotFoundPage'))
const PrivacyPage = lazyWithRetry(() => import('@/pages/PrivacyPage'))
const TermsPage = lazyWithRetry(() => import('@/pages/TermsPage'))
const GoodbyePage = lazyWithRetry(() => import('@/pages/GoodbyePage'))

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
      <Loader2 className="h-7 w-7 animate-spin text-clay" strokeWidth={1.25} aria-hidden="true" />
    </div>
  )
}

export default function App() {
  const { pathname } = useLocation()
  return (
    <ErrorBoundary resetKey={pathname}>
    <RouteEffects />
    <Toaster />
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public routes (no shell) */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/signup" element={<SignupPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/goodbye" element={<GoodbyePage />} />

        {/* Protected app routes */}
        <Route element={<ProtectedRoute />}>
          {/* Onboarding — no shell */}
          <Route path="/onboarding" element={<OnboardingPage />} />

          <Route element={<PageShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/feed" element={<ActivityFeedPage />} />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/listing/:id" element={<ListingDetailPage />} />
            <Route path="/listing/:id/edit" element={<EditListingPage />} />
            <Route path="/listing/new" element={<CreateListingPage />} />
            <Route path="/offers" element={<OffersInboxPage />} />
            <Route path="/offers/:id" element={<OfferThreadPage />} />
            <Route path="/agreements" element={<AgreementsPage />} />
            <Route path="/agreements/:id" element={<AgreementDetailPage />} />
            {/* bartrrr.app/profile is your own profile (T-70); signed out, log in first */}
            <Route path="/profile" element={<Navigate to="/profile/me" replace />} />
            <Route path="/profile/:username" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  )
}
