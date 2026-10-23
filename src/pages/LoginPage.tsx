import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Input } from '@/components/ui'
import { AuthDivider, OAuthButtons } from '@/components/auth'
import { useAuth } from '@/providers/AuthProvider'
import { DEMO_MODE, HAS_SUPABASE } from '@/lib/env'
import {
  DEFAULT_AFTER_LOGIN,
  authPathWithReturn,
  friendlyAuthError,
  sanitizeReturnTo,
  signInWithEmail,
} from '@/lib/auth'
import { ValidationError } from '@/lib/validation'

// Demo-only picker: never bundled unless VITE_DEMO_MODE=true at build time
// (the env check must be inline so the bundler can drop the import)
const DemoUserPicker =
  import.meta.env.VITE_DEMO_MODE === 'true' && DEMO_MODE
    ? lazy(() => import('@/components/auth/DemoUserPicker'))
    : null

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, isLoading } = useAuth()

  const returnTo = sanitizeReturnTo(searchParams.get('returnTo')) ?? DEFAULT_AFTER_LOGIN
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(searchParams.get('error'))
  const [awaitingSession, setAwaitingSession] = useState(false)

  // After a successful sign-in, AuthProvider loads the profile; go once it has.
  useEffect(() => {
    if (awaitingSession && isAuthenticated) navigate(returnTo, { replace: true })
  }, [awaitingSession, isAuthenticated, navigate, returnTo])

  if (isAuthenticated && !awaitingSession && !isLoading) {
    return <Navigate to={returnTo} replace />
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoggingIn(true)
    setLoginError(null)
    try {
      await signInWithEmail(email, password)
      setAwaitingSession(true)
    } catch (err) {
      setLoginError(err instanceof ValidationError ? err.message.replace(/^\w+: /, '') : friendlyAuthError(err))
    } finally {
      setIsLoggingIn(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/">
            <span className="text-[20px] font-medium lowercase tracking-tight text-ink">
              bartrrr
            </span>
          </Link>
          <h1 className="sr-only">Log in to Bartrrr</h1>
          <p className="text-sm text-muted mt-1">Welcome back, neighbor.</p>
        </div>

        {HAS_SUPABASE && (
          <div className="border border-ink bg-cream p-6">
            <OAuthButtons returnTo={returnTo} onError={setLoginError} disabled={isLoggingIn} />

            <AuthDivider label="or use email" />

            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              <Input
                id="login-email"
                label="Email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                id="login-password"
                label="Password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="text-right -mt-2">
                <Link
                  to="/auth/forgot-password"
                  className="text-small text-ink underline underline-offset-4"
                >
                  Forgot password?
                </Link>
              </div>

              {loginError && (
                <p role="alert" className="text-sm text-clay text-center">{loginError}</p>
              )}
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                type="submit"
                loading={isLoggingIn || awaitingSession}
                disabled={!email || !password}
              >
                {isLoggingIn || awaitingSession ? 'Signing in…' : 'Log in'}
              </Button>
            </form>
          </div>
        )}

        {DemoUserPicker && (
          <div className={HAS_SUPABASE ? 'mt-6' : undefined}>
            <Suspense fallback={null}>
              <DemoUserPicker onDone={() => navigate(returnTo, { replace: true })} />
            </Suspense>
          </div>
        )}

        <p className="text-center text-base text-muted mt-4">
          New to Bartrrr?{' '}
          <Link
            to={authPathWithReturn('/auth/signup', returnTo)}
            className="text-ink font-medium underline underline-offset-4"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
