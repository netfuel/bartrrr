import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { PageShell, ProtectedRoute } from '@/components/layout'

// Route-level code splitting: each page loads on demand, keeping heavy
// deps (mapbox-gl on Browse, gsap on Landing, confetti on Agreements)
// out of the initial bundle.
const LandingPage = lazy(() => import('@/pages/LandingPage'))
const BrowsePage = lazy(() => import('@/pages/BrowsePage'))
const ListingDetailPage = lazy(() => import('@/pages/ListingDetailPage'))
const CreateListingPage = lazy(() => import('@/pages/CreateListingPage'))
const OffersInboxPage = lazy(() => import('@/pages/OffersInboxPage'))
const OfferThreadPage = lazy(() => import('@/pages/OfferThreadPage'))
const AgreementsPage = lazy(() => import('@/pages/AgreementsPage'))
const AgreementDetailPage = lazy(() => import('@/pages/AgreementDetailPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const SignupPage = lazy(() => import('@/pages/SignupPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const EditListingPage = lazy(() => import('@/pages/EditListingPage'))
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'))
const ActivityFeedPage = lazy(() => import('@/pages/ActivityFeedPage'))

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-clay" />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public routes (no shell) */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/signup" element={<SignupPage />} />

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
            <Route path="/profile/:username" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
