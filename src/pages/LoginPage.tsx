import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Star } from 'lucide-react'
import { Button, Avatar } from '@/components/ui'
import { AuthShell } from '@/components/layout'
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
      await login(selectedUser.displayName.split(' ')[0].toLowerCase())
      navigate(returnTo)
    } catch (err) {
      console.error('Login failed:', err)
      setLoginError("We couldn't log you in. Check your connection and try again.")
    } finally {
      setIsLoggingIn(false)
    }
  }

  const selectedUser = users.find((u) => u.id === selectedUserId)

  return (
    <AuthShell image="/photo-editorial.jpg" caption={<>Trade, <em>don't buy.</em></>}>
        {/* Heading */}
        <div className="mb-10 animate-fade-up">
          <h1 className="text-heading-page text-ink">Welcome back, neighbor.</h1>
        </div>

        {/* User picker */}
        <div className="animate-fade-up stagger-1">
          <p className="text-label text-muted mb-3">
            Pick a demo neighbor to log in as
          </p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="-mx-1 space-y-1 max-h-[22rem] overflow-y-auto border-y border-ink/20 px-1 py-2">
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
                  <Avatar
                    name={user.displayName}
                    userId={user.id}
                    src={user.avatarUrl}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-ink truncate">
                      {user.displayName}
                    </p>
                    <p className="text-small text-muted">{user.neighborhood}</p>
                  </div>
                  <div className="flex items-center gap-1 text-small tabular-nums text-ink-2 shrink-0">
                    <Star className="h-3.5 w-3.5 fill-gold text-gold" />
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
              disabled={!selectedUserId || isLoggingIn}
            >
              {isLoggingIn
                ? 'Signing in…'
                : `Log in as ${selectedUser?.displayName.split(' ')[0] || '…'}`}
            </Button>
          </form>
        </div>

        <p className="text-small text-muted mt-6">
          This is a demo: pick any neighbor to explore Bartrrr.
        </p>
    </AuthShell>
  )
}
