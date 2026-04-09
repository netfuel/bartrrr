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

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedUserId) {
      login(selectedUserId)
      navigate('/browse')
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/">
            <span className="font-display text-3xl font-bold text-clay">Bartrrr</span>
          </Link>
          <p className="text-sm text-muted mt-1">Join your neighbors. Start trading.</p>
        </div>

        {/* ── Idle: ask for location ── */}
        {geoState === 'idle' && (
          <div className="bg-white rounded-xl p-6 shadow-sm text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-clay-light text-clay">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-ink">Available in Memphis, TN</p>
              <p className="text-sm text-muted mt-1 leading-relaxed">
                Bartrrr is currently available in the greater Memphis metro area. Let us confirm you're nearby.
              </p>
            </div>
            <Button variant="primary" size="lg" className="w-full" onClick={checkLocation}>
              <MapPin className="h-4 w-4" /> Check my location
            </Button>
            <button
              type="button"
              onClick={() => setGeoState('manual')}
              className="text-sm text-clay underline underline-offset-2"
            >
              Enter zip code manually
            </button>
          </div>
        )}

        {/* ── Checking ── */}
        {geoState === 'checking' && (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center space-y-4">
            <Loader2 className="h-10 w-10 text-clay animate-spin mx-auto" />
            <p className="text-sm text-muted">Checking your location…</p>
          </div>
        )}

        {/* ── Outside service area ── */}
        {geoState === 'outside' && (
          <div className="bg-white rounded-xl p-6 shadow-sm text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-sand-light text-muted">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-ink">Not available yet</p>
              {detectedZip && (
                <p className="text-xs text-muted mt-1">Detected zip: {detectedZip}</p>
              )}
              <p className="text-sm text-muted mt-2 leading-relaxed">
                Bartrrr is currently serving the Memphis, TN metro area (zip codes 38103–38157 and surrounding).
                We hope to expand soon!
              </p>
            </div>
            <Link to="/">
              <Button variant="outline" className="w-full">Back to home</Button>
            </Link>
            <button
              type="button"
              onClick={() => { setGeoState('manual'); setDetectedZip(null) }}
              className="text-sm text-clay underline underline-offset-2"
            >
              Try a different zip code
            </button>
          </div>
        )}

        {/* ── Permission denied: manual entry ── */}
        {(geoState === 'denied' || geoState === 'manual') && (
          <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
            {geoState === 'denied' && (
              <p className="text-sm text-muted text-center">
                Location access was denied. Enter your zip code to check availability.
              </p>
            )}
            {geoState === 'manual' && (
              <p className="text-sm text-muted text-center">
                Enter your zip code to check if Bartrrr is available in your area.
              </p>
            )}
            <Input
              label="Zip code"
              placeholder="e.g. 38104"
              value={manualZip}
              onChange={(e) => { setManualZip(e.target.value); setManualError('') }}
              maxLength={5}
              onKeyDown={(e) => e.key === 'Enter' && checkManualZip()}
            />
            {manualError && <p className="text-xs text-clay">{manualError}</p>}
            <Button variant="primary" className="w-full" onClick={checkManualZip}>
              Check availability
            </Button>
            <button
              type="button"
              onClick={() => setGeoState('idle')}
              className="w-full text-sm text-muted underline underline-offset-2"
            >
              Use my location instead
            </button>
          </div>
        )}

        {/* ── Allowed: show user picker ── */}
        {geoState === 'allowed' && (
          <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-teal text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                {detectedZip
                  ? `Zip ${detectedZip} is in our service area!`
                  : 'Your location is in our service area!'}
              </span>
            </div>
            <p className="text-sm font-medium text-ink-2">Choose a user to explore as:</p>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                      selectedUserId === user.id
                        ? 'border-clay bg-clay-light'
                        : 'border-sand-light hover:border-sand'
                    }`}
                  >
                    <Avatar name={user.displayName} userId={user.id} src={user.avatarUrl} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{user.displayName}</p>
                      <p className="text-xs text-muted">{user.neighborhood}</p>
                    </div>
                    <div className="flex items-center gap-0.5 text-xs text-gold shrink-0">
                      <Star className="h-3 w-3 fill-gold" />
                      {user.reputationScore.toFixed(1)}
                    </div>
                  </button>
                ))}
              </div>
              <Button variant="primary" size="lg" className="w-full" type="submit" disabled={!selectedUserId}>
                Join as {selectedUser?.displayName.split(' ')[0] || '…'}
              </Button>
            </form>
          </div>
        )}

        <p className="text-center text-xs text-muted mt-4">
          This is a demo — pick any user to explore Bartrrr.
        </p>
        <p className="text-center text-sm text-muted mt-2">
          Already have an account?{' '}
          <Link to="/auth/login" className="text-clay font-medium">Log in</Link>
        </p>
      </div>
    </div>
  )
}
