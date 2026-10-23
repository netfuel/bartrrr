import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { AuthShell } from '@/components/auth'
import { showToast } from '@/stores'
import {
  completeAuthRedirect,
  friendlyAuthError,
  readAuthErrorFromUrl,
  updatePassword,
} from '@/lib/auth'
import { ValidationError } from '@/lib/validation'

type Phase = 'verifying' | 'ready' | 'invalid'

/**
 * Target of the password-recovery email. supabase-js exchanges the link's
 * ?code= for a short-lived session on load; with that session the user can
 * set a new password.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>(() => (readAuthErrorFromUrl() ? 'invalid' : 'verifying'))
  const [linkError, setLinkError] = useState<string | null>(() => {
    const fromUrl = readAuthErrorFromUrl()
    return fromUrl ? friendlyAuthError(fromUrl) : null
  })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (phase !== 'verifying') return
    let cancelled = false
    completeAuthRedirect()
      .then(({ error: exchangeError, hasSession }) => {
        if (cancelled) return
        if (exchangeError || !hasSession) {
          setLinkError(friendlyAuthError(exchangeError ?? 'expired'))
          setPhase('invalid')
        } else {
          setPhase('ready')
        }
      })
      .catch((err) => {
        if (cancelled) return
        setLinkError(friendlyAuthError(err))
        setPhase('invalid')
      })
    return () => {
      cancelled = true
    }
  }, [phase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError("Those passwords don't match.")
      return
    }
    setIsSaving(true)
    try {
      await updatePassword(password)
      showToast('Your password has been updated.', 'success')
      navigate('/browse', { replace: true })
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : friendlyAuthError(err))
    } finally {
      setIsSaving(false)
    }
  }

  if (phase === 'verifying') {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
          <Loader2 className="h-8 w-8 animate-spin text-ink" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-sm text-muted">Checking your reset link…</p>
        </div>
      </div>
    )
  }

  if (phase === 'invalid') {
    return (
      <AuthShell title="Reset link expired">
        <div className="space-y-4 text-center">
          <p role="alert" className="text-base text-ink-2">
            {linkError ?? 'That reset link is invalid or has already been used.'}
          </p>
          <Link to="/auth/forgot-password" className="block">
            <Button variant="primary" size="lg" className="w-full">Send a new link</Button>
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          id="reset-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          helperText="At least 8 characters, with letters and numbers."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          id="reset-password-confirm"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && <p role="alert" className="text-sm text-clay text-center">{error}</p>}
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          type="submit"
          loading={isSaving}
          disabled={!password || !confirm}
        >
          Update password
        </Button>
      </form>
    </AuthShell>
  )
}
