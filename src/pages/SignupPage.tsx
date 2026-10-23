import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapPin, Star, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button, Avatar, Input } from '@/components/ui'
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
    const selectedUser = users.find((u) => u.id === selectedUserId)
    if (!selectedUser) return
    setIsSigningUp(true)
    setSignupError(null)
    try {
      await login(selectedUser.displayName.split(' ')[0].toLowerCase())
      navigate('/onboarding')
    } catch (err) {
      console.error('Signup failed:', err)
      setSignupError("We couldn't create your account. Check your connection and try again.")
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
                  Bartrrr is just for the Memphis metro for now. Let's check that you're nearby. We only use your location to confirm your area.
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
                Enter a ZIP code instead
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
                  <p className="text-small text-muted mt-1">Your ZIP code: {detectedZip}</p>
                )}
                <p className="text-base text-muted mt-2 leading-relaxed">
                  Bartrrr is only in the Memphis, TN metro right now. We're working on more cities.
                  If you're in the Memphis area, try your home ZIP code.
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
                Try a different ZIP code
              </button>
            </div>
          )}

          {/* ── Permission denied: manual entry ── */}
          {(geoState === 'denied' || geoState === 'manual') && (
            <div className="border border-ink bg-cream p-8 space-y-5">
              <p className="text-base text-muted text-center leading-relaxed">
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
                className="w-full min-h-[44px] text-base text-muted underline underline-offset-4"
              >
                Use my location instead
              </button>
            </div>
          )}

          {/* ── Allowed: show user picker ── */}
          {geoState === 'allowed' && (
            <div className="border border-ink bg-cream p-8 space-y-5">
              <div className="flex items-center gap-2 text-teal-dark text-base font-medium">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>
                  {detectedZip
                    ? `Good news: ${detectedZip} is in our area.`
                    : "Good news: you're in our area."}
                </span>
              </div>
              <p className="text-base font-medium text-ink-2">Pick a demo neighbor to explore as</p>
              <form onSubmit={handleSignup} className="space-y-5">
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUserId(user.id)}
                      aria-pressed={selectedUserId === user.id}
                      className={`pressable w-full flex items-center gap-3 p-4 rounded-none border-2 transition-colors text-left ${
                        selectedUserId === user.id
                          ? 'border-ink bg-sand-light'
                          : 'border-sand-light hover:border-sand'
                      }`}
                    >
                      <Avatar name={user.displayName} userId={user.id} src={user.avatarUrl} size="lg" />
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium text-ink truncate">{user.displayName}</p>
                        <p className="text-small text-muted">{user.neighborhood}</p>
                      </div>
                      <div className="flex items-center gap-1 text-small text-gold shrink-0">
                        <Star className="h-4 w-4 fill-gold" />
                        {user.reputationScore.toFixed(1)}
                      </div>
                    </button>
                  ))}
                </div>
                {signupError && (
                  <p role="alert" className="text-base text-clay text-center animate-fade-in">{signupError}</p>
                )}
                <Button variant="primary" size="lg" className="w-full" type="submit" loading={isSigningUp} disabled={!selectedUserId}>
                  {isSigningUp ? 'Joining…' : `Join as ${selectedUser?.displayName.split(' ')[0] || '…'}`}
                </Button>
              </form>
            </div>
          )}

        </div>

        <p className="text-center text-small text-muted mt-5">
          This is a demo: pick any neighbor to explore Bartrrr.
        </p>
        <p className="text-center text-base text-muted mt-2">
          Already have an account?{' '}
          <Link to="/auth/login" className="text-ink font-medium underline underline-offset-4">Log in</Link>
        </p>
      </div>
    </div>
  )
}
