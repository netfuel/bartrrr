import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input } from '@/components/ui'
import { useAuth } from '@/providers/AuthProvider'
import { useUsersStore, showToast } from '@/stores'
import { usePageTitle } from '@/lib/utils'
import type { NotificationPrefs } from '@/types'

const DEFAULT_PREFS: NotificationPrefs = {
  newOffers: true,
  messages: true,
  agreementUpdates: true,
  tradeCompletions: true,
  perfectMatches: true,
}

const NOTIF_LABELS: { key: keyof NotificationPrefs; label: string }[] = [
  { key: 'newOffers',         label: 'New offers and counter-offers' },
  { key: 'messages',          label: 'Messages from neighbors' },
  { key: 'agreementUpdates',  label: 'Trade agreements to sign' },
  { key: 'tradeCompletions',  label: 'Completed trades and reviews' },
  { key: 'perfectMatches',    label: 'New listings that match what you want' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const { currentUser, logout } = useAuth()
  const updateUser = useUsersStore((s) => s.updateUser)

  const [displayName, setDisplayName] = useState(currentUser?.displayName || '')
  const [neighborhood, setNeighborhood] = useState(currentUser?.neighborhood || '')
  const [bio, setBio] = useState(currentUser?.bio || '')
  const [prefs, setPrefs] = useState<NotificationPrefs>(
    currentUser?.notificationPrefs ?? DEFAULT_PREFS
  )
  const [saved, setSaved] = useState(false)
  const [nameError, setNameError] = useState('')
  usePageTitle('Settings')

  if (!currentUser) return null

  const togglePref = (key: keyof NotificationPrefs) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }))
  }

  const handleSave = () => {
    if (!displayName.trim()) {
      setNameError('Add a name so neighbors know who they’re trading with.')
      return
    }
    updateUser(currentUser.id, {
      displayName: displayName.trim(),
      neighborhood: neighborhood.trim(),
      bio: bio.trim(),
      notificationPrefs: prefs,
    })
    setSaved(true)
    showToast('Settings saved.', 'success')
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-heading-page text-ink mb-6">Settings</h1>

      {/* Profile section */}
      <section className="border border-ink bg-cream p-6 mb-6">
        <h2 className="font-display text-lg font-semibold text-ink mb-4">Profile</h2>
        <div className="space-y-4">
          <Input
            label="Display name"
            value={displayName}
            onChange={(e) => { setDisplayName(e.target.value); setNameError('') }}
            error={nameError || undefined}
            helperText="This is how neighbors see you."
            maxLength={50}
          />
          <Input
            label="Neighborhood"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            helperText="Shown on your listings instead of your address."
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="settings-bio" className="text-sm font-medium text-ink-2">Bio</label>
            <textarea
              id="settings-bio"
              placeholder="A line or two about you and what you like to trade"
              className="rounded-none border border-ink bg-cream px-3 py-2.5 text-[15px] text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink resize-y min-h-[80px]"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="border border-ink bg-cream p-6 mb-6">
        <h2 className="font-display text-lg font-semibold text-ink mb-1">Notifications</h2>
        <p className="text-small text-muted mb-4">Choose what we let you know about.</p>
        <div className="space-y-3">
          {NOTIF_LABELS.map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-ink-2">{label}</span>
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={() => togglePref(key)}
                className="w-4 h-4 accent-clay"
              />
            </label>
          ))}
        </div>
      </section>

      {/* Save button */}
      <Button variant="primary" size="sm" onClick={handleSave} className="mb-6">
        {saved ? '✓ Saved' : 'Save changes'}
      </Button>

      {/* Account */}
      <section className="border border-ink bg-cream p-6">
        <h2 className="font-display text-lg font-semibold text-ink mb-4">Account</h2>
        <Button variant="outline" size="sm" onClick={() => { logout().then(() => navigate('/auth/login')) }}>
          Log out
        </Button>
      </section>
    </div>
  )
}
