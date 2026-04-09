import { Routes, Route } from 'react-router-dom'
import { PageShell, ProtectedRoute } from '@/components/layout'

import LandingPage from '@/pages/LandingPage'
import BrowsePage from '@/pages/BrowsePage'
import ListingDetailPage from '@/pages/ListingDetailPage'
import CreateListingPage from '@/pages/CreateListingPage'
import OffersInboxPage from '@/pages/OffersInboxPage'
import OfferThreadPage from '@/pages/OfferThreadPage'
import AgreementsPage from '@/pages/AgreementsPage'
import AgreementDetailPage from '@/pages/AgreementDetailPage'
import ProfilePage from '@/pages/ProfilePage'
import SettingsPage from '@/pages/SettingsPage'
import LoginPage from '@/pages/LoginPage'
import SignupPage from '@/pages/SignupPage'
import DashboardPage from '@/pages/DashboardPage'
import EditListingPage from '@/pages/EditListingPage'
import OnboardingPage from '@/pages/OnboardingPage'

export default function App() {
  return (
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
  )
}
