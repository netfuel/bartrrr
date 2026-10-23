import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button, Input, buttonStyles } from '@/components/ui'
import { AuthShell } from '@/components/layout'
import { usePageTitle } from '@/lib/utils'
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
  usePageTitle('Choose a new password')
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
      setError("Those passwords don't match. Type the same new password in both fields.")
      return
    }
    setIsSaving(true)
    try {
      await updatePassword(password)
      showToast("Password updated. You're logged in.", 'success')
      navigate('/browse', { replace: true })
    } catch (err) {
      setError(err instanceof ValidationError ? err.message.replace(/^\w+: /, '') : friendlyAuthError(err))
    } finally {
      setIsSaving(false)
    }
  }

  if (phase === 'verifying') {
    return (
      <div className="min-h-[100svh] bg-cream flex items-center justify-center px-4" aria-busy="true">
        <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
          <Loader2 className="h-7 w-7 animate-spin text-clay" strokeWidth={1.25} aria-hidden="true" />
          <p className="text-label text-muted">Checking your reset link…</p>
        </div>
      </div>
    )
  }

  if (phase === 'invalid') {
    return (
      <AuthShell image="/photo-editorial.jpg" caption={<>Trade, <em>don't buy.</em></>}>
        <div className="mb-10 animate-fade-up">
          <h1 className="text-heading-page text-ink">This reset link has expired</h1>
        </div>
        <div className="border-t border-ink pt-6 space-y-6 animate-fade-up stagger-1">
          <p role="alert" className="text-base text-ink-2 leading-relaxed">
            {linkError ?? 'That link was already used or is no longer valid.'}
          </p>
          <p className="text-small text-muted">Reset links work once, for 1 hour.</p>
          <Link to="/auth/forgot-password" className={buttonStyles({ variant: 'primary', size: 'lg', className: 'w-full' })}>
            Send a new link
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell image="/photo-editorial.jpg" caption={<>Trade, <em>don't buy.</em></>}>
      <div className="mb-10 animate-fade-up">
        <h1 className="text-heading-page text-ink">Choose a new password</h1>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5 animate-fade-up stagger-1" noValidate>
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
          label="Type it again"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-small text-clay-dark text-center animate-fade-in">{error}</p>
        )}
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          type="submit"
          loading={isSaving}
          disabled={!password || !confirm}
        >
          {isSaving ? 'Saving…' : 'Save new password'}
        </Button>
        {!isSaving && (!password || !confirm) && (
          <p className="text-small text-muted text-center">Enter your new password twice to save it.</p>
        )}
      </form>
    </AuthShell>
  )
}
