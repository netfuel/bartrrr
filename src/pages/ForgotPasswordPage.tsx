import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input } from '@/components/ui'
import { AuthShell } from '@/components/layout'
import { usePageTitle } from '@/lib/utils'
import { friendlyAuthError, requestPasswordReset } from '@/lib/auth'
import { ValidationError } from '@/lib/validation'

export default function ForgotPasswordPage() {
  usePageTitle('Reset your password')
  const [email, setEmail] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSending(true)
    setError(null)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof ValidationError ? err.message.replace(/^\w+: /, '') : friendlyAuthError(err))
    } finally {
      setIsSending(false)
    }
  }

  return (
    <AuthShell image="/photo-editorial.jpg" caption={<>Trade, <em>don't buy.</em></>}>
      <div className="mb-10 animate-fade-up">
        <h1 className="text-heading-page text-ink">{sent ? 'Check your email' : 'Reset your password'}</h1>
        {!sent && (
          <p className="text-base text-ink-2 mt-3">
            Enter the email you signed up with. We'll send you a link to choose a new password.
          </p>
        )}
      </div>

      <div className="animate-fade-up stagger-1">
        {sent ? (
          <div role="status" className="border-t border-ink pt-6 space-y-3">
            <p className="text-base text-ink-2 leading-relaxed">
              If there's an account for <span className="font-medium text-ink">{email.trim()}</span>, a
              reset link is on its way. It works for 1 hour.
            </p>
            <p className="text-small text-muted">
              Don't see it? Check your spam folder, or send another link in a minute.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <Input
              id="forgot-email"
              label="Email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-small text-clay-dark text-center animate-fade-in">{error}</p>
            )}
            <Button variant="primary" size="lg" className="w-full" type="submit" loading={isSending} disabled={!email}>
              {isSending ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}
      </div>

      <div className="mt-10 border-t border-ink/20 pt-6">
        <Link
          to="/auth/login"
          className="text-base font-medium text-ink underline decoration-clay decoration-1 underline-offset-4 hover:decoration-2"
        >
          Back to log in
        </Link>
      </div>
    </AuthShell>
  )
}
