import { useState } from 'react'
import { Star } from 'lucide-react'
import { Avatar, Button } from '@/components/ui'
import { useAuth } from '@/providers/AuthProvider'
import { useUsersStore } from '@/stores'

/**
 * "Log in as a sample neighbor" picker. Only reachable when the build sets
 * VITE_DEMO_MODE=true: callers import it behind that flag, so production
 * builds never include it.
 */
export default function DemoUserPicker({ onDone }: { onDone: () => void }) {
  const { login } = useAuth()
  const users = useUsersStore((s) => s.users)
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || '')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const selectedUser = users.find((u) => u.id === selectedUserId)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    setIsLoggingIn(true)
    setLoginError(null)
    try {
      await login(selectedUser.displayName.split(' ')[0].toLowerCase())
      onDone()
    } catch (err) {
      console.error('Demo login failed:', err)
      setLoginError('Login failed. Please try again.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  if (users.length === 0) return null

  return (
    <div className="border border-ink bg-cream p-6">
      <p id="demo-picker-label" className="text-sm font-medium text-ink-2 mb-3">
        Demo mode: choose a sample neighbor to explore as
      </p>
      <form onSubmit={handleLogin} className="space-y-4">
        <div role="group" aria-labelledby="demo-picker-label" className="space-y-2 max-h-72 overflow-y-auto">
          {users.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => setSelectedUserId(user.id)}
              aria-pressed={selectedUserId === user.id}
              className={`pressable w-full flex items-center gap-3 p-3 rounded-none border transition-colors text-left ${
                selectedUserId === user.id
                  ? 'border-ink bg-sand-light'
                  : 'border-sand-light hover:border-sand'
              }`}
            >
              <Avatar name={user.displayName} userId={user.id} src={user.avatarUrl} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{user.displayName}</p>
                <p className="text-xs text-muted">{user.neighborhood}</p>
              </div>
              <div className="flex items-center gap-0.5 text-xs text-gold shrink-0">
                <Star className="h-3 w-3 fill-gold" aria-hidden="true" />
                {user.reputationScore.toFixed(1)}
              </div>
            </button>
          ))}
        </div>

        {loginError && (
          <p role="alert" className="text-sm text-clay text-center">{loginError}</p>
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
            ? 'Signing in…'
            : `Explore as ${selectedUser?.displayName.split(' ')[0] || '…'}`}
        </Button>
      </form>
    </div>
  )
}
