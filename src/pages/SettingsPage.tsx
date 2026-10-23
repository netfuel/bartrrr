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
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="text-heading-page text-ink mb-10">Settings</h1>

      {/* Profile section */}
      <section className="grid gap-6 border-t border-ink py-8 md:grid-cols-[180px_1fr] md:gap-10">
        <h2 className="text-heading-section text-ink">Profile</h2>
        <div className="space-y-5">
          <Input label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <Input label="Neighborhood" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="settings-bio" className="text-label text-ink-2">Bio</label>
            <textarea
              id="settings-bio"
              className="rounded-none border border-ink/40 bg-paper px-4 py-3 text-base text-ink placeholder:text-muted hover:border-ink focus:outline-none focus:border-clay focus:ring-1 focus:ring-clay resize-y min-h-[110px] transition-colors"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="grid gap-6 border-t border-ink py-8 md:grid-cols-[180px_1fr] md:gap-10">
        <h2 className="text-heading-section text-ink">Notifications</h2>
        <div className="divide-y divide-ink/15 border-y border-ink/15">
          {NOTIF_LABELS.map(({ key, label }) => (
            <label key={key} className="group flex min-h-[56px] items-center justify-between gap-4 cursor-pointer">
              <span className="text-[16px] text-ink">{label}</span>
              {/* Switch: native checkbox kept for semantics, drawn as a track */}
              <span className="relative inline-flex shrink-0">
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={() => togglePref(key)}
                  className="peer absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none rounded-full"
                />
                <span
                  aria-hidden="true"
                  className="h-7 w-12 rounded-full border border-ink bg-cream transition-colors duration-300 peer-checked:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-clay"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-ink transition-[transform,background-color] duration-300 ease-spring peer-checked:translate-x-5 peer-checked:bg-cream"
                />
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* Save button */}
      <div className="flex justify-end border-t border-ink py-6">
        <Button variant="primary" onClick={handleSave} className="min-w-[160px]">
          {saved ? '✓ Saved!' : 'Save changes'}
        </Button>
      </div>

      {/* Account */}
      <section className="grid gap-6 border-t border-ink py-8 md:grid-cols-[180px_1fr] md:gap-10">
        <h2 className="text-heading-section text-ink">Account</h2>
        <div>
          <Button variant="outline" onClick={() => { logout().then(() => navigate('/auth/login')) }}>
            Log out
          </Button>
        </div>
      </section>
    </div>
  )
}
