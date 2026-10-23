import { useState } from 'react'
import { Star } from 'lucide-react'
import { Avatar, Button } from '@/components/ui'
import { useAuth } from '@/providers/AuthProvider'
import { useUsersStore } from '@/stores'

/**
 * "Explore as a sample neighbor" picker. Only reachable when the build sets
 * VITE_DEMO_MODE=true: callers import it behind that flag, so production
 * builds never include it.
 */
export default function DemoUserPicker({
  onDone,
  mode = 'login',
}: {
  onDone: () => void
  mode?: 'login' | 'signup'
}) {
  const { login } = useAuth()
  const users = useUsersStore((s) => s.users)
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || '')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const selectedUser = users.find((u) => u.id === selectedUserId)
  const firstName = selectedUser?.displayName.split(' ')[0] || '…'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    setIsLoggingIn(true)
    setLoginError(null)
    try {
      await login(selectedUser.displayName.split(' ')[0].toLowerCase())
      onDone()
    } catch (err) {
      console.error('[Bartrrr] Demo login failed', err)
      setLoginError("We couldn't open the demo. Reload the page and try again.")
    } finally {
      setIsLoggingIn(false)
    }
  }

  if (users.length === 0) return null

  return (
    <div>
      <p id="demo-picker-label" className="text-label text-muted mb-3">
        Demo mode: pick a sample neighbor to explore as
      </p>
      <form onSubmit={handleLogin} className="space-y-6">
        <div
          role="group"
          aria-labelledby="demo-picker-label"
          className="-mx-1 space-y-1 max-h-[22rem] overflow-y-auto border-y border-ink/20 px-1 py-2"
        >
          {users.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => setSelectedUserId(user.id)}
              aria-pressed={selectedUserId === user.id}
              className={`pressable group w-full flex items-center gap-3 px-4 py-3 rounded-none border text-left transition-[background-color,border-color] duration-300 ${
                selectedUserId === user.id
                  ? 'border-ink bg-paper'
                  : 'border-transparent hover:border-ink/30 hover:bg-paper/60'
              }`}
            >
              <Avatar name={user.displayName} userId={user.id} src={user.avatarUrl} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-ink truncate">{user.displayName}</p>
                <p className="text-small text-muted">{user.neighborhood}</p>
              </div>
              <div className="flex items-center gap-1 text-small tabular-nums text-ink-2 shrink-0">
                <Star className="h-3.5 w-3.5 fill-gold text-gold" aria-hidden="true" />
                {user.reputationScore.toFixed(1)}
              </div>
              <span
                aria-hidden="true"
                className={`ml-1 h-2 w-2 shrink-0 rounded-full transition-colors ${selectedUserId === user.id ? 'bg-clay' : 'bg-transparent'}`}
              />
            </button>
          ))}
        </div>

        {loginError && (
          <p role="alert" className="text-small text-clay-dark text-center animate-fade-in">{loginError}</p>
        )}
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          type="submit"
          loading={isLoggingIn}
          disabled={!selectedUserId}
        >
          {isLoggingIn
            ? mode === 'signup' ? 'Joining…' : 'Logging in…'
            : mode === 'signup' ? `Join as ${firstName}` : `Log in as ${firstName}`}
        </Button>
      </form>
      <p className="text-small text-muted mt-4">
        This is a demo: pick any neighbor to explore Bartrrr.
      </p>
    </div>
  )
}
