import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapPin, Star, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button, Avatar, Input, buttonStyles } from '@/components/ui'
import { AuthShell } from '@/components/layout'
import { useAuth } from '@/providers/AuthProvider'
import { useUsersStore } from '@/stores'
import { requestLocation, getZipFromCoords } from '@/lib/utils/geolocation'
import { isMemphisZip } from '@/lib/utils/zip'

type GeoState = 'idle' | 'checking' | 'allowed' | 'outside' | 'denied' | 'manual'

export default function SignupPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const users = useUsersStore((s) => s.users)
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || '')
  const [geoState, setGeoState] = useState<GeoState>('idle')
  const [detectedZip, setDetectedZip] = useState<string | null>(null)
  const [manualZip, setManualZip] = useState('')
  const [manualError, setManualError] = useState('')
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [signupError, setSignupError] = useState<string | null>(null)

  const selectedUser = users.find((u) => u.id === selectedUserId)

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
    const selectedUser = users.find((u) => u.id === selectedUserId)
    if (!selectedUser) return
    setIsSigningUp(true)
    setSignupError(null)
    try {
      await login(selectedUser.displayName.split(' ')[0].toLowerCase())
      navigate('/onboarding')
    } catch (err) {
      console.error('Signup failed:', err)
      setSignupError('Something went wrong. Please try again.')
    } finally {
      setIsSigningUp(false)
    }
  }

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
                  Bartrrr is currently available in the greater Memphis metro area. Let us confirm you're nearby.
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
                Enter zip code manually
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
                  <p className="text-small text-muted mt-1">Detected zip: {detectedZip}</p>
                )}
                <p className="text-base text-muted mt-2 leading-relaxed">
                  Bartrrr is currently serving the Memphis, TN metro area (zip codes 38103–38157 and surrounding).
                  We hope to expand soon!
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
                Try a different zip code
              </button>
            </div>
          )}

          {/* ── Permission denied: manual entry ── */}
          {(geoState === 'denied' || geoState === 'manual') && (
            <div className="border-t border-ink pt-6 space-y-6">
              <p className="text-base text-ink-2 leading-relaxed">
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
                className="link-underline inline-flex min-h-[44px] items-center text-base text-muted hover:text-ink"
              >
                Use my location instead
              </button>
            </div>
          )}

          {/* ── Allowed: show user picker ── */}
          {geoState === 'allowed' && (
            <div className="border-t border-ink pt-6 space-y-5">
              <div className="flex items-center gap-2 bg-teal-light px-4 py-3 text-teal-dark text-[15px] font-medium">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>
                  {detectedZip
                    ? `Zip ${detectedZip} is in our service area!`
                    : 'Your location is in our service area!'}
                </span>
              </div>
              <p className="text-label text-muted">Choose a user to explore as:</p>
              <form onSubmit={handleSignup} className="space-y-5">
                <div className="-mx-1 space-y-1 max-h-80 overflow-y-auto px-1">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUserId(user.id)}
                      aria-pressed={selectedUserId === user.id}
                      className={`pressable w-full flex items-center gap-3 px-4 py-3 rounded-none border text-left transition-[background-color,border-color] duration-300 ${
                        selectedUserId === user.id
                          ? 'border-ink bg-paper'
                          : 'border-transparent hover:border-ink/30 hover:bg-paper/60'
                      }`}
                    >
                      <Avatar name={user.displayName} userId={user.id} src={user.avatarUrl} size="lg" />
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium text-ink truncate">{user.displayName}</p>
                        <p className="text-small text-muted">{user.neighborhood}</p>
                      </div>
                      <div className="flex items-center gap-1 text-small tabular-nums text-ink-2 shrink-0">
                        <Star className="h-3.5 w-3.5 fill-gold text-gold" />
                        {user.reputationScore.toFixed(1)}
                      </div>
                    </button>
                  ))}
                </div>
                {signupError && (
                  <p role="alert" className="text-small text-clay-dark text-center animate-fade-in">{signupError}</p>
                )}
                <Button variant="primary" size="lg" className="w-full" type="submit" loading={isSigningUp} disabled={!selectedUserId}>
                  {isSigningUp ? 'Joining…' : `Join as ${selectedUser?.displayName.split(' ')[0] || '…'}`}
                </Button>
              </form>
            </div>
          )}

        </div>

        <div className="mt-10 space-y-2 border-t border-ink/20 pt-6">
          <p className="text-small text-muted">
            This is a demo — pick any user to explore Bartrrr.
          </p>
          <p className="text-base text-ink-2">
            Already have an account?{' '}
            <Link to="/auth/login" className="font-medium text-ink underline decoration-clay decoration-1 underline-offset-4 hover:decoration-2">Log in</Link>
          </p>
        </div>
    </AuthShell>
  )
}
