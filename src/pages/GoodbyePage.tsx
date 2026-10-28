import { useEffect, useRef } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Wordmark, buttonStyles } from '@/components/ui'
import { usePageTitle } from '@/lib/utils'
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal'
import { forgetDeletedSession } from '@/lib/account-deletion'
import { useAuth } from '@/providers/AuthProvider'

interface GoodbyeState {
  accountDeleted?: boolean
  demo?: boolean
}

/** Shown once, right after a neighbor deletes their account in Settings. */
export default function GoodbyePage() {
  const state = (useLocation().state ?? {}) as GoodbyeState
  const { logout } = useAuth()
  const signedOut = useRef(false)
  usePageTitle('Account deleted')

  // Settings sends people here after the server deletes the account. Sign
  // this device out now that a public page is on screen.
  useEffect(() => {
    if (!state.accountDeleted || signedOut.current) return
    signedOut.current = true
    void forgetDeletedSession().then(logout)
  }, [state.accountDeleted, logout])

  if (!state.accountDeleted) return <Navigate to="/" replace />

  return (
    <div className="min-h-[100svh] bg-cream flex flex-col px-5 py-6">
      <Link to="/" aria-label="Bartrrr home" className="self-start rounded-sm">
        <Wordmark />
      </Link>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-12 animate-fade-up">
        <p className="text-label text-muted">{state.demo ? 'Logged out' : 'Account deleted'}</p>
        <h1 className="text-display !text-[clamp(2.75rem,8vw,4.5rem)] text-ink mt-4">
          Thanks for trading, <em>neighbor.</em>
        </h1>
        {state.demo ? (
          <p className="text-base text-ink-2 mt-6 max-w-md leading-relaxed">
            This was the demo, so nothing was deleted. You’re logged out, and the sample neighbors are still here if
            you want to look around again.
          </p>
        ) : (
          <>
            <p className="text-base text-ink-2 mt-6 max-w-md leading-relaxed">
              Your account is deleted and you’re logged out. Your profile, photos and listings are no longer on
              Bartrrr, and your past trades now show “Former neighbor” in place of your name.
            </p>
            <p className="text-base text-ink-2 mt-4 max-w-md leading-relaxed">
              Copies may stay in backups for a short time before they’re overwritten. Questions? Email{' '}
              <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-ink underline underline-offset-[3px] hover:text-clay-dark">
                {LEGAL_CONTACT_EMAIL}
              </a>
              .
            </p>
          </>
        )}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link to="/" replace className={buttonStyles({ variant: 'primary', size: 'lg' })}>
            Go to the home page
          </Link>
        </div>
      </main>
    </div>
  )
}
