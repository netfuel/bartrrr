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
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8 animate-fade-up">
          <Link to="/">
            <span className="font-display text-4xl font-bold text-clay">Bartrrr</span>
          </Link>
          <p className="text-base text-muted mt-2">Join your neighbors. Start trading.</p>
        </div>

        {/* key replays the entrance animation on every step change */}
        <div key={geoState} className="animate-scale-in">

          {/* ── Idle: ask for location ── */}
          {geoState === 'idle' && (
            <div className="bg-white rounded-xl p-8 shadow-lift text-center space-y-5">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-clay-light text-clay">
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
                className="inline-flex min-h-[44px] items-center text-base text-clay underline underline-offset-4"
              >
                Enter zip code manually
              </button>
            </div>
          )}

          {/* ── Checking ── */}
          {geoState === 'checking' && (
            <div className="bg-white rounded-xl p-10 shadow-lift text-center space-y-4">
              <Loader2 className="h-10 w-10 text-clay animate-spin mx-auto" />
              <p className="text-base text-muted">Checking your location…</p>
            </div>
          )}

          {/* ── Outside service area ── */}
          {geoState === 'outside' && (
            <div className="bg-white rounded-xl p-8 shadow-lift text-center space-y-5">
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
                className="inline-flex min-h-[44px] items-center text-base text-clay underline underline-offset-4"
              >
                Try a different zip code
              </button>
            </div>
          )}

          {/* ── Permission denied: manual entry ── */}
          {(geoState === 'denied' || geoState === 'manual') && (
            <div className="bg-white rounded-xl p-8 shadow-lift space-y-5">
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

          {/* ── Allowed: show user picker ── */}
          {geoState === 'allowed' && (
            <div className="bg-white rounded-xl p-8 shadow-lift space-y-5">
              <div className="flex items-center gap-2 text-teal-dark text-base font-medium">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>
                  {detectedZip
                    ? `Zip ${detectedZip} is in our service area!`
                    : 'Your location is in our service area!'}
                </span>
              </div>
              <p className="text-base font-medium text-ink-2">Choose a user to explore as:</p>
              <form onSubmit={handleSignup} className="space-y-5">
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUserId(user.id)}
                      aria-pressed={selectedUserId === user.id}
                      className={`pressable w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-colors text-left ${
                        selectedUserId === user.id
                          ? 'border-clay bg-clay-light'
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
                  <p className="text-base text-clay text-center animate-fade-in">{signupError}</p>
                )}
                <Button variant="primary" size="lg" className="w-full" type="submit" loading={isSigningUp} disabled={!selectedUserId}>
                  {isSigningUp ? 'Joining…' : `Join as ${selectedUser?.displayName.split(' ')[0] || '…'}`}
                </Button>
              </form>
            </div>
          )}

        </div>

        <p className="text-center text-small text-muted mt-5">
          This is a demo — pick any user to explore Bartrrr.
        </p>
        <p className="text-center text-base text-muted mt-2">
          Already have an account?{' '}
          <Link to="/auth/login" className="text-clay font-medium underline-offset-4 hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  )
}
