import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Star } from 'lucide-react'
import { Button, Avatar } from '@/components/ui'
import { useAuth } from '@/providers/AuthProvider'
import { useUsersStore } from '@/stores'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  const users = useUsersStore((s) => s.users)
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || '')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const returnTo = searchParams.get('returnTo') || '/browse'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const selectedUser = users.find((u) => u.id === selectedUserId)
    if (!selectedUser) return

    setIsLoggingIn(true)
    setLoginError(null)
    try {
      await login(selectedUser.username)
      navigate(returnTo)
    } catch (err) {
      console.error('Login failed:', err)
      setLoginError('Login failed. Please try again.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const selectedUser = users.find((u) => u.id === selectedUserId)

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/">
            <span className="font-display text-3xl font-bold text-clay">
              Bartrrr
            </span>
          </Link>
          <p className="text-sm text-muted mt-1">Welcome back, neighbor.</p>
        </div>

        {/* User picker */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-sm font-medium text-ink-2 mb-3">
            Choose a user to log in as:
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
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
                  <Avatar
                    name={user.displayName}
                    userId={user.id}
                    src={user.avatarUrl}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">
                      {user.displayName}
                    </p>
                    <p className="text-xs text-muted">{user.neighborhood}</p>
                  </div>
                  <div className="flex items-center gap-0.5 text-xs text-gold shrink-0">
                    <Star className="h-3 w-3 fill-gold" />
                    {user.reputationScore.toFixed(1)}
                  </div>
                </button>
              ))}
            </div>

            {loginError && (
              <p className="text-sm text-red-500 text-center">{loginError}</p>
            )}
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              type="submit"
              disabled={!selectedUserId || isLoggingIn}
            >
              {isLoggingIn
                ? 'Signing in…'
                : `Log in as ${selectedUser?.displayName.split(' ')[0] || '...'}`}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted mt-4">
          This is a demo — pick any user to explore Bartrrr.
        </p>
      </div>
    </div>
  )
}
