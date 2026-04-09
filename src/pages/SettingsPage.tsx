import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input } from '@/components/ui'
import { useAuth } from '@/providers/AuthProvider'
import { useUsersStore } from '@/stores'
import type { NotificationPrefs } from '@/types'

const DEFAULT_PREFS: NotificationPrefs = {
  newOffers: true,
  messages: true,
  agreementUpdates: true,
  tradeCompletions: true,
  perfectMatches: true,
}

const NOTIF_LABELS: { key: keyof NotificationPrefs; label: string }[] = [
  { key: 'newOffers',         label: 'New offers on my listings' },
  { key: 'messages',          label: 'Messages in offer threads' },
  { key: 'agreementUpdates',  label: 'Agreement updates & signing' },
  { key: 'tradeCompletions',  label: 'Trade completions' },
  { key: 'perfectMatches',    label: 'Perfect Match alerts' },
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

  if (!currentUser) return null

  const togglePref = (key: keyof NotificationPrefs) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }))
  }

  const handleSave = () => {
    updateUser(currentUser.id, { displayName, neighborhood, bio, notificationPrefs: prefs })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="font-display text-2xl font-bold text-ink mb-6">Settings</h1>

      {/* Profile section */}
      <section className="bg-white rounded-lg p-6 border border-sand-light mb-6">
        <h2 className="font-display text-lg font-semibold text-ink mb-4">Profile</h2>
        <div className="space-y-4">
          <Input label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <Input label="Neighborhood" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-2">Bio</label>
            <textarea
              className="rounded-md border border-sand bg-white px-3 py-2.5 text-[15px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-clay focus:border-clay resize-y min-h-[80px]"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-white rounded-lg p-6 border border-sand-light mb-6">
        <h2 className="font-display text-lg font-semibold text-ink mb-4">Notifications</h2>
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
        {saved ? '✓ Saved!' : 'Save changes'}
      </Button>

      {/* Account */}
      <section className="bg-white rounded-lg p-6 border border-sand-light">
        <h2 className="font-display text-lg font-semibold text-ink mb-4">Account</h2>
        <Button variant="outline" size="sm" onClick={() => { logout(); navigate('/auth/login') }}>
          Log out
        </Button>
      </section>
    </div>
  )
}
