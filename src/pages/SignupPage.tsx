import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { MapPin, Loader2, AlertCircle, CheckCircle2, MailCheck } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { AuthDivider, OAuthButtons } from '@/components/auth'
import { useAuth } from '@/providers/AuthProvider'
import { requestLocation, getZipFromCoords } from '@/lib/utils/geolocation'
import { isMemphisZip } from '@/lib/utils/zip'
import { DEMO_MODE, HAS_SUPABASE } from '@/lib/env'
import { authPathWithReturn, friendlyAuthError, sanitizeReturnTo, signUpWithEmail } from '@/lib/auth'
import { ValidationError } from '@/lib/validation'

// Demo-only picker: never bundled unless VITE_DEMO_MODE=true at build time
// (the env check must be inline so the bundler can drop the import)
const DemoUserPicker =
  import.meta.env.VITE_DEMO_MODE === 'true' && DEMO_MODE
    ? lazy(() => import('@/components/auth/DemoUserPicker'))
    : null

type GeoState = 'idle' | 'checking' | 'allowed' | 'outside' | 'denied' | 'manual'

export default function SignupPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, isLoading } = useAuth()
  const returnTo = sanitizeReturnTo(searchParams.get('returnTo'))
  const [geoState, setGeoState] = useState<GeoState>('idle')
  const [detectedZip, setDetectedZip] = useState<string | null>(null)
  const [manualZip, setManualZip] = useState('')
  const [manualError, setManualError] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [signupError, setSignupError] = useState<string | null>(null)
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null)
  const [awaitingSession, setAwaitingSession] = useState(false)

  // Email signup without confirmation signs in immediately; continue once
  // AuthProvider has the profile. New accounts go through onboarding.
  useEffect(() => {
    if (awaitingSession && isAuthenticated) navigate('/onboarding', { replace: true })
  }, [awaitingSession, isAuthenticated, navigate])

  if (isAuthenticated && !awaitingSession && !isLoading) {
    return <Navigate to={returnTo ?? '/browse'} replace />
  }

  const checkLocation = async () => {
    setGeoState('checking')
    try {
      const coords = await requestLocation()
      const zip = await getZipFromCoords(coords.latitude, coords.longitude)
      setDetectedZip(zip)
      if (zip && isMemphisZip(zip)) {
        setGeoState('allowed')
      } else {
        setGeoState('outside')
      }
    } catch {
      // Permission denied or error — fall back to manual entry
      setGeoState('denied')
    }
  }

  const checkManualZip = () => {
    setManualError('')
    const zip = manualZip.trim()
    if (!/^\d{5}$/.test(zip)) {
      setManualError('Please enter a valid 5-digit zip code.')
      return
    }
    if (isMemphisZip(zip)) {
      setDetectedZip(zip)
      setGeoState('allowed')
    } else {
      setDetectedZip(zip)
      setGeoState('outside')
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSigningUp(true)
    setSignupError(null)
    try {
      const { needsEmailConfirmation } = await signUpWithEmail({
        displayName,
        email,
        password,
        returnTo,
      })
      if (needsEmailConfirmation) setConfirmationSentTo(email.trim())
      else setAwaitingSession(true)
    } catch (err) {
      if (err instanceof ValidationError) {
        const [field, message] = err.message.split(': ')
        const label: Record<string, string> = { displayName: 'Name', email: 'Email', password: 'Password' }
        setSignupError(message ? `${label[field] ?? field}: ${message}` : err.message)
      } else {
        setSignupError(friendlyAuthError(err))
      }
    } finally {
      setIsSigningUp(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8 animate-fade-up">
          <Link to="/">
            <span className="text-[20px] font-medium lowercase tracking-tight text-ink">bartrrr</span>
          </Link>
          <p className="text-base text-muted mt-2">Join your neighbors. Start trading.</p>
        </div>

        {/* key replays the entrance animation on every step change */}
        <div key={geoState} className="animate-scale-in">

          {/* ── Idle: ask for location ── */}
          {geoState === 'idle' && (
            <div className="border border-ink bg-cream p-8 text-center space-y-5">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-ink text-ink">
                <MapPin className="h-7 w-7" />
              </div>
              <div>
                <p className="font-display text-2xl font-semibold text-ink">Available in Memphis, TN</p>
                <p className="text-base text-muted mt-2 leading-relaxed">
                  Bartrrr is currently available in the greater Memphis metro area. Let us confirm you're nearby.
                </p>
              </div>
              <Button variant="primary" size="lg" className="w-full" onClick={checkLocation}>
                <MapPin className="h-5 w-5" /> Check my location
              </Button>
              <button
                type="button"
                onClick={() => setGeoState('manual')}
                className="inline-flex min-h-[44px] items-center text-base text-ink underline underline-offset-4"
              >
                Enter zip code manually
              </button>
            </div>
          )}

          {/* ── Checking ── */}
          {geoState === 'checking' && (
            <div className="border border-ink bg-cream p-10 text-center space-y-4">
              <Loader2 className="h-10 w-10 text-ink animate-spin mx-auto" strokeWidth={1.5} />
              <p className="text-base text-muted">Checking your location…</p>
            </div>
          )}

          {/* ── Outside service area ── */}
          {geoState === 'outside' && (
            <div className="border border-ink bg-cream p-8 text-center space-y-5">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sand-light text-muted">
                <AlertCircle className="h-7 w-7" />
              </div>
              <div>
                <p className="font-display text-2xl font-semibold text-ink">Not available yet</p>
                {detectedZip && (
                  <p className="text-small text-muted mt-1">Detected zip: {detectedZip}</p>
                )}
                <p className="text-base text-muted mt-2 leading-relaxed">
                  Bartrrr is currently serving the Memphis, TN metro area (zip codes 38103–38157 and surrounding).
                  We hope to expand soon!
                </p>
              </div>
              <Link to="/">
                <Button variant="outline" size="lg" className="w-full">Back to home</Button>
              </Link>
              <button
                type="button"
                onClick={() => { setGeoState('manual'); setDetectedZip(null) }}
                className="inline-flex min-h-[44px] items-center text-base text-ink underline underline-offset-4"
              >
                Try a different zip code
              </button>
            </div>
          )}

          {/* ── Permission denied: manual entry ── */}
          {(geoState === 'denied' || geoState === 'manual') && (
            <div className="border border-ink bg-cream p-8 space-y-5">
              <p className="text-base text-muted text-center leading-relaxed">
                {geoState === 'denied'
                  ? 'Location access was denied. Enter your zip code to check availability.'
                  : 'Enter your zip code to check if Bartrrr is available in your area.'}
              </p>
              <Input
                label="Zip code"
                placeholder="e.g. 38104"
                value={manualZip}
                onChange={(e) => { setManualZip(e.target.value); setManualError('') }}
                maxLength={5}
                inputMode="numeric"
                error={manualError || undefined}
                onKeyDown={(e) => e.key === 'Enter' && checkManualZip()}
              />
              <Button variant="primary" size="lg" className="w-full" onClick={checkManualZip}>
                Check availability
              </Button>
              <button
                type="button"
                onClick={() => setGeoState('idle')}
                className="w-full min-h-[44px] text-base text-muted underline underline-offset-4"
              >
                Use my location instead
              </button>
            </div>
          )}

          {/* ── Allowed: create the account ── */}
          {geoState === 'allowed' && !confirmationSentTo && (
            <div className="border border-ink bg-cream p-8 space-y-5">
              <div className="flex items-center gap-2 text-teal-dark text-base font-medium">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>
                  {detectedZip
                    ? `Zip ${detectedZip} is in our service area!`
                    : 'Your location is in our service area!'}
                </span>
              </div>

              {HAS_SUPABASE && (
                <>
                  <OAuthButtons
                    returnTo={returnTo}
                    onError={setSignupError}
                    disabled={isSigningUp || awaitingSession}
                  />

                  <AuthDivider label="or sign up with email" />

                  <form onSubmit={handleSignup} className="space-y-4" noValidate>
                    <Input
                      id="signup-name"
                      label="Your name"
                      autoComplete="name"
                      required
                      maxLength={60}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                    <Input
                      id="signup-email"
                      label="Email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <Input
                      id="signup-password"
                      label="Password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      helperText="At least 8 characters, with letters and numbers."
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    {signupError && (
                      <p role="alert" className="text-base text-clay text-center animate-fade-in">{signupError}</p>
                    )}
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full"
                      type="submit"
                      loading={isSigningUp || awaitingSession}
                      disabled={!displayName.trim() || !email || !password}
                    >
                      {isSigningUp || awaitingSession ? 'Creating your account…' : 'Create account'}
                    </Button>
                  </form>
                </>
              )}

              {DemoUserPicker && (
                <Suspense fallback={null}>
                  <DemoUserPicker onDone={() => navigate('/onboarding', { replace: true })} />
                </Suspense>
              )}
            </div>
          )}

          {/* ── Email confirmation sent ── */}
          {confirmationSentTo && (
            <div className="border border-ink bg-cream p-8 text-center space-y-4" role="status">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-ink text-ink">
                <MailCheck className="h-7 w-7" />
              </div>
              <p className="font-display text-2xl font-semibold text-ink">Check your email</p>
              <p className="text-base text-muted leading-relaxed">
                We sent a confirmation link to <span className="font-medium text-ink">{confirmationSentTo}</span>.
                Open it on this device to finish creating your account.
              </p>
            </div>
          )}

        </div>

        <p className="text-center text-base text-muted mt-5">
          Already have an account?{' '}
          <Link
            to={authPathWithReturn('/auth/login', returnTo)}
            className="text-ink font-medium underline underline-offset-4"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
