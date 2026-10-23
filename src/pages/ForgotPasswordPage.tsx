import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input } from '@/components/ui'
import { AuthShell } from '@/components/auth'
import { friendlyAuthError, requestPasswordReset } from '@/lib/auth'
import { ValidationError } from '@/lib/validation'

export default function ForgotPasswordPage() {
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
      setError(err instanceof ValidationError ? err.message : friendlyAuthError(err))
    } finally {
      setIsSending(false)
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle={sent ? undefined : "We'll email you a link to choose a new one."}
      footer={
        <Link to="/auth/login" className="text-ink font-medium underline underline-offset-4">
          Back to log in
        </Link>
      }
    >
      {sent ? (
        <p role="status" className="text-base text-ink-2 text-center leading-relaxed">
          If an account exists for <span className="font-medium text-ink">{email.trim()}</span>, a
          reset link is on its way. It expires in one hour.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
          {error && <p role="alert" className="text-sm text-clay text-center">{error}</p>}
          <Button variant="primary" size="lg" className="w-full" type="submit" loading={isSending} disabled={!email}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
