import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { MapPin, Loader2, AlertCircle, CheckCircle2, MailCheck } from 'lucide-react'
import { Button, Input, AuthDivider, buttonStyles } from '@/components/ui'
import { AuthShell } from '@/components/layout'
import { OAuthButtons } from '@/components/auth'
import { useAuth } from '@/providers/AuthProvider'
import { requestLocation, getZipFromCoords } from '@/lib/utils/geolocation'
import { isMemphisZip } from '@/lib/utils/zip'
import { usePageTitle } from '@/lib/utils'
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
  usePageTitle('Join')
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
      setManualError('Enter a 5-digit ZIP code, like 38104.')
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

  const busy = isSigningUp || awaitingSession
  const missingFields = [
    !displayName.trim() && 'your name',
    !email && 'your email',
    !password && 'a password',
  ].filter(Boolean) as string[]

  return (
    <AuthShell image="/photo-community.jpg" caption={<>Your neighbor has <em>exactly</em> what you need.</>}>

        {/* Heading */}
        <div className="mb-10 animate-fade-up">
          <h1 className="text-heading-page text-ink">Join your neighbors. Start trading.</h1>
        </div>

        {/* key replays the entrance animation on every step change */}
        <div key={geoState} className="animate-scale-in">

          {/* ── Idle: ask for location ── */}
          {geoState === 'idle' && (
            <div className="space-y-6">
              <div className="flex items-start gap-4 border-t border-ink pt-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink text-clay">
                  <MapPin className="h-5 w-5" />
                </span>
                <div>
                <p className="text-heading-section text-ink">Available in Memphis, TN</p>
                <p className="text-base text-ink-2 mt-2 leading-relaxed">
                  Bartrrr is just for the Memphis metro for now. Let's check that you're nearby. We only use your location to confirm your area.
                </p>
                </div>
              </div>
              <Button variant="primary" size="lg" className="w-full" onClick={checkLocation}>
                <MapPin className="h-5 w-5" /> Check my location
              </Button>
              <button
                type="button"
                onClick={() => setGeoState('manual')}
                className="link-underline inline-flex min-h-[44px] items-center text-base text-ink"
              >
                Enter a ZIP code instead
              </button>
            </div>
          )}

          {/* ── Checking ── */}
          {geoState === 'checking' && (
            <div className="border-t border-ink pt-10 space-y-4" aria-live="polite">
              <Loader2 className="h-8 w-8 text-clay animate-spin" strokeWidth={1.5} />
              <p className="text-base text-muted">Checking your location…</p>
            </div>
          )}

          {/* ── Outside service area ── */}
          {geoState === 'outside' && (
            <div className="border-t border-ink pt-6 space-y-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sand-light text-muted">
                <AlertCircle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-heading-section text-ink">Not available yet</p>
                {detectedZip && (
                  <p className="text-small text-muted mt-1">Your ZIP code: {detectedZip}</p>
                )}
                <p className="text-base text-muted mt-2 leading-relaxed">
                  Bartrrr is only in the Memphis, TN metro right now. We're working on more cities.
                  If you're in the Memphis area, try your home ZIP code.
                </p>
              </div>
              <Link to="/" className={buttonStyles({ variant: 'outline', size: 'lg', className: 'w-full' })}>
                Back to home
              </Link>
              <button
                type="button"
                onClick={() => { setGeoState('manual'); setDetectedZip(null) }}
                className="link-underline inline-flex min-h-[44px] items-center text-base text-ink"
              >
                Try a different ZIP code
              </button>
            </div>
          )}

          {/* ── Permission denied: manual entry ── */}
          {(geoState === 'denied' || geoState === 'manual') && (
            <div className="border-t border-ink pt-6 space-y-6">
              <p className="text-base text-ink-2 leading-relaxed">
                {geoState === 'denied'
                  ? "We couldn't get your location. Enter your ZIP code instead."
                  : "Enter your ZIP code to see if Bartrrr is in your area."}
              </p>
              <Input
                label="ZIP code"
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
                className="link-underline inline-flex min-h-[44px] items-center text-base text-muted hover:text-ink"
              >
                Use my location instead
              </button>
            </div>
          )}

          {/* ── Allowed: create the account ── */}
          {geoState === 'allowed' && !confirmationSentTo && (
            <div className="border-t border-ink pt-6 space-y-6">
              <div className="flex items-center gap-2 bg-teal-light px-4 py-3 text-teal-dark text-[15px] font-medium">
                <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>
                  {detectedZip
                    ? `Good news: ${detectedZip} is in our area.`
                    : "Good news: you're in our area."}
                </span>
              </div>

              {HAS_SUPABASE && (
                <>
                  <OAuthButtons returnTo={returnTo} onError={setSignupError} disabled={busy} />

                  <AuthDivider>or sign up with email</AuthDivider>

                  <form onSubmit={handleSignup} className="space-y-5" noValidate>
                    <Input
                      id="signup-name"
                      label="Your name"
                      autoComplete="name"
                      required
                      maxLength={60}
                      helperText="Your first name is fine. Neighbors see it on your listings and offers."
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
                      <p role="alert" className="text-small text-clay-dark text-center animate-fade-in">{signupError}</p>
                    )}
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full"
                      type="submit"
                      loading={busy}
                      disabled={missingFields.length > 0}
                    >
                      {busy ? 'Creating your account…' : 'Create account'}
                    </Button>
                    {!busy && missingFields.length > 0 && (
                      <p className="text-small text-muted text-center">
                        Add {missingFields.join(', ').replace(/, ([^,]*)$/, ' and $1')} to continue.
                      </p>
                    )}
                  </form>
                </>
              )}

              {!HAS_SUPABASE && signupError && (
                <p role="alert" className="text-small text-clay-dark text-center animate-fade-in">{signupError}</p>
              )}

              {DemoUserPicker && (
                <div className={HAS_SUPABASE ? 'border-t border-ink/20 pt-6' : undefined}>
                  <Suspense fallback={null}>
                    <DemoUserPicker mode="signup" onDone={() => navigate('/onboarding', { replace: true })} />
                  </Suspense>
                </div>
              )}
            </div>
          )}

          {/* ── Email confirmation sent ── */}
          {confirmationSentTo && (
            <div className="border-t border-ink pt-6 space-y-5" role="status">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-ink text-clay">
                <MailCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-heading-section text-ink">Check your email</p>
                <p className="text-base text-ink-2 mt-2 leading-relaxed">
                  We sent a link to <span className="font-medium text-ink">{confirmationSentTo}</span>.
                  Open it on this device to finish creating your account.
                </p>
                <p className="text-small text-muted mt-3">
                  Don't see it? Check your spam folder, or wait a minute and sign up again.
                </p>
              </div>
            </div>
          )}

        </div>

        <div className="mt-10 space-y-2 border-t border-ink/20 pt-6">
          <p className="text-base text-ink-2">
            Already have an account?{' '}
            <Link to={authPathWithReturn('/auth/login', returnTo)} className="font-medium text-ink underline decoration-clay decoration-1 underline-offset-4 hover:decoration-2">Log in</Link>
          </p>
        </div>
    </AuthShell>
  )
}
