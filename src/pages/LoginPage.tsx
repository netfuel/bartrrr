import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Input, AuthDivider } from '@/components/ui'
import { AuthShell } from '@/components/layout'
import { OAuthButtons } from '@/components/auth'
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
import { usePageTitle } from '@/lib/utils'

// Demo-only picker: never bundled unless VITE_DEMO_MODE=true at build time
// (the env check must be inline so the bundler can drop the import)
const DemoUserPicker =
  import.meta.env.VITE_DEMO_MODE === 'true' && DEMO_MODE
    ? lazy(() => import('@/components/auth/DemoUserPicker'))
    : null

export default function LoginPage() {
  usePageTitle('Log in')
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

  const busy = isLoggingIn || awaitingSession

  return (
    <AuthShell image="/photo-editorial.jpg" caption={<>Trade, <em>don't buy.</em></>}>
      {/* Heading */}
      <div className="mb-10 animate-fade-up">
        <h1 className="text-heading-page text-ink">Welcome back, neighbor.</h1>
      </div>

      {HAS_SUPABASE && (
        <div className="space-y-6 animate-fade-up stagger-1">
          <OAuthButtons returnTo={returnTo} onError={setLoginError} disabled={busy} />

          <AuthDivider>or log in with email</AuthDivider>

          <form onSubmit={handleLogin} className="space-y-5" noValidate>
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
            <div className="space-y-2">
              <Input
                id="login-password"
                label="Password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="text-right">
                <Link
                  to="/auth/forgot-password"
                  className="link-underline inline-flex min-h-[44px] items-center text-small text-ink"
                >
                  Forgot your password?
                </Link>
              </div>
            </div>

            {loginError && (
              <p role="alert" className="text-small text-clay-dark text-center animate-fade-in">{loginError}</p>
            )}
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              type="submit"
              loading={busy}
              disabled={!email || !password}
            >
              {busy ? 'Logging in…' : 'Log in'}
            </Button>
            {!busy && (!email || !password) && (
              <p className="text-small text-muted text-center">Enter your email and password to log in.</p>
            )}
          </form>
        </div>
      )}

      {DemoUserPicker && (
        <div className={HAS_SUPABASE ? 'mt-10 border-t border-ink/20 pt-6' : 'animate-fade-up stagger-1'}>
          <Suspense fallback={null}>
            <DemoUserPicker
              mode="login"
              onDone={() => navigate(returnTo, { replace: true })}
            />
          </Suspense>
        </div>
      )}

      {!HAS_SUPABASE && !DemoUserPicker && loginError && (
        <p role="alert" className="text-small text-clay-dark">{loginError}</p>
      )}

      <div className="mt-10 border-t border-ink/20 pt-6">
        <p className="text-base text-ink-2">
          New to Bartrrr?{' '}
          <Link
            to={authPathWithReturn('/auth/signup', returnTo)}
            className="font-medium text-ink underline decoration-clay decoration-1 underline-offset-4 hover:decoration-2"
          >
            Create an account
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
