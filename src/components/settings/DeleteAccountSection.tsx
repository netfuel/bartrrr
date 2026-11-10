import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Button, Input, Modal, SocialAuthButton } from '@/components/ui'
import { useAuth } from '@/providers/AuthProvider'
import { useUsersStore } from '@/stores'
import { useAgreementsForUser, useOffersForUser } from '@/stores/selectors'
import {
  ACCOUNT_DELETION_IS_DEMO,
  AccountDeletionError,
  CONFIRM_RETURN_PATH,
  confirmWithPassword,
  deleteMyAccount,
  getReauthMethod,
  readOAuthConfirm,
  startOAuthConfirm,
  type ReauthMethod,
} from '@/lib/account-deletion'
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal'

const CONFIRM_WORD = 'DELETE'
const OPEN_OFFER = new Set(['pending', 'countered'])
const OPEN_AGREEMENT = new Set(['draft', 'under_review', 'pending_signatures', 'active'])

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

/** "Jamie", "Jamie and Ann", "Jamie, Ann and 2 other neighbors" */
function listNames(names: string[]) {
  if (names.length <= 2) return names.join(' and ')
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`
  return `${names[0]}, ${names[1]} and ${names.length - 2} other neighbors`
}

function reauthCopy(method: ReauthMethod | null | undefined) {
  if (method?.kind === 'oauth') {
    return `For your security, confirm it’s you with ${method.provider.label} again, then delete. Your account is still here.`
  }
  return 'For your security, enter your password again, then delete. Your account is still here.'
}

function errorCopy(err: unknown, method: ReauthMethod | null | undefined) {
  const kind = err instanceof AccountDeletionError ? err.kind : 'server'
  if (kind === 'network') {
    return 'We couldn’t reach Bartrrr, so your account is still here. Check your connection and try again.'
  }
  if (kind === 'session') {
    return 'Your sign-in has expired, so your account is still here. Log out, log back in, then try again from Settings.'
  }
  if (kind === 'reauth') return reauthCopy(method)
  if (kind === 'rate_limited') {
    return 'Too many tries in a row, so your account is still here. Wait a minute, then try again.'
  }
  return `Something went wrong on our end, and your account is still here. Try again in a moment, or email ${LEGAL_CONTACT_EMAIL} and we’ll delete it for you.`
}

const WRONG_PASSWORD =
  'That password doesn’t match. Try again, or log out and use “Forgot your password?” to set a new one.'

const NOT_CONFIRMED = 'We couldn’t confirm it’s you, so nothing was deleted. Try again below.'

interface DialogState {
  /** Remounts the dialog when it's reopened */
  key: number
  /** Back from Google or Apple with a fresh sign-in */
  oauthConfirmed: boolean
  /** Shown when the dialog opens (the provider round trip didn't work) */
  notice: string | null
}

/**
 * Settings → Delete account. Kept in its own component so the rest of
 * Settings can change without touching this flow.
 *
 * Google and Apple users confirm it's them by going through the provider
 * again. It brings them back to /settings?confirm=delete, which reopens the
 * dialog here, confirmed.
 */
export function DeleteAccountSection() {
  const { currentUser } = useAuth()
  const [params, setParams] = useSearchParams()
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [otherAccount, setOtherAccount] = useState(false)
  const handledReturn = useRef(false)
  const opens = useRef(0)
  const returning = params.get('confirm') === 'delete'
  const userId = currentUser?.id

  useEffect(() => {
    if (!returning || !userId || handledReturn.current) return
    // A ref, not effect cleanup: the result is single-use, so a second
    // (StrictMode) run must not read it again and drop the first answer
    handledReturn.current = true
    const next = new URLSearchParams(params)
    next.delete('confirm')
    setParams(next, { replace: true })
    void readOAuthConfirm(userId).then((result) => {
      handledReturn.current = false
      if (result === 'other_account') {
        setDialog(null)
        setOtherAccount(true)
        return
      }
      setOtherAccount(false)
      setDialog({
        key: ++opens.current,
        oauthConfirmed: result === 'confirmed',
        notice: result === 'confirmed' ? null : NOT_CONFIRMED,
      })
    })
  }, [returning, userId, params, setParams])

  return (
    <section
      aria-labelledby="delete-account-heading"
      className="mt-16 grid gap-6 border-t border-ink/25 py-8 md:grid-cols-[180px_1fr] md:gap-10"
    >
      <h2 id="delete-account-heading" className="text-heading-section text-ink">
        Delete account
      </h2>
      <div className="space-y-4">
        <p className="text-[16px] leading-relaxed text-ink-2 max-w-prose">
          Remove your profile, listings and photos from Bartrrr for good. Past trades stay with the neighbors you
          traded with, under “Former neighbor”.
        </p>
        {otherAccount && (
          <p
            role="alert"
            className="max-w-prose border border-clay/40 bg-paper px-4 py-3 text-sm leading-relaxed text-clay-dark"
          >
            You came back logged in to a different account, so nothing was deleted. To delete the other account, log
            out, log in to it, then try again from Settings.
          </p>
        )}
        <Button
          variant="outline"
          onClick={() => {
            setOtherAccount(false)
            setDialog({ key: ++opens.current, oauthConfirmed: false, notice: null })
          }}
        >
          Delete account
        </Button>
      </div>
      {dialog && (
        <DeleteAccountDialog
          key={dialog.key}
          oauthConfirmed={dialog.oauthConfirmed}
          notice={dialog.notice}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  )
}

function DeleteAccountDialog({
  oauthConfirmed: confirmedOnOpen,
  notice,
  onClose,
}: {
  oauthConfirmed: boolean
  notice: string | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const users = useUsersStore((s) => s.users)
  const offers = useOffersForUser(currentUser?.id)
  const agreements = useAgreementsForUser(currentUser?.id)

  /** undefined while loading, null when there's no session */
  const [method, setMethod] = useState<ReauthMethod | null | undefined>(undefined)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [oauthConfirmed, setOauthConfirmed] = useState(confirmedOnOpen)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(notice)
  const titleId = useId()
  const inputId = useId()
  const passwordId = useId()
  const formId = useId()
  const userId = currentUser?.id

  // Load the goodbye page now, so it can show even if the connection drops
  // right after the account is deleted
  useEffect(() => {
    void import('@/pages/GoodbyePage')
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void getReauthMethod(userId)
      .catch(() => null)
      .then((m) => {
        if (cancelled) return
        setMethod(m)
        if (m === null) setError(errorCopy(new AccountDeletionError('session'), m))
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const open = useMemo(() => {
    if (!currentUser) return { offers: 0, agreements: 0, names: [] as string[] }
    const me = currentUser.id
    const openOffers = offers.filter((o) => OPEN_OFFER.has(o.status))
    const openAgreements = agreements.filter((a) => OPEN_AGREEMENT.has(a.status))
    const others = new Set<string>([
      ...openOffers.map((o) => (o.fromUserId === me ? o.toUserId : o.fromUserId)),
      ...openAgreements.map((a) => (a.partyA.userId === me ? a.partyB.userId : a.partyA.userId)),
    ])
    const names = [...others].map(
      (id) => users.find((u) => u.id === id)?.displayName.split(' ')[0] || 'a neighbor',
    )
    return { offers: openOffers.length, agreements: openAgreements.length, names }
  }, [currentUser, offers, agreements, users])

  if (!currentUser) return null

  const wordMatches = typed.trim().toUpperCase() === CONFIRM_WORD
  const identityReady =
    method?.kind === 'password' ? password.length > 0 : method?.kind === 'oauth' ? oauthConfirmed : false
  const ready = wordMatches && identityReady
  const close = () => {
    if (!busy && !leaving) onClose()
  }

  const handleConfirmWithProvider = async () => {
    if (method?.kind !== 'oauth' || busy || leaving) return
    setLeaving(true)
    setError(null)
    try {
      const result = await startOAuthConfirm(method.provider, currentUser.id)
      if (result === 'demo') {
        // Nothing leaves the app in the demo: come straight back like the
        // provider would
        setLeaving(false)
        navigate(CONFIRM_RETURN_PATH, { replace: true })
      }
      // Otherwise the browser is on its way to the provider
    } catch (err) {
      setError(
        err instanceof AccountDeletionError && err.kind === 'network'
          ? errorCopy(err, method)
          : `We couldn’t open ${method.provider.label}. Try again in a moment.`,
      )
      setLeaving(false)
    }
  }

  const handleDelete = async () => {
    if (!ready || busy || !method) return
    setBusy(true)
    setError(null)
    setPasswordError(null)
    try {
      if (method.kind === 'password') await confirmWithPassword(method.email, password)
      await deleteMyAccount(currentUser.id)
    } catch (err) {
      const kind = err instanceof AccountDeletionError ? err.kind : 'server'
      if (kind === 'password') {
        setPasswordError(WRONG_PASSWORD)
      } else {
        if (kind === 'reauth') {
          setOauthConfirmed(false)
          setPassword('')
        }
        setError(errorCopy(err, method))
      }
      setBusy(false)
      return
    }
    // The account is gone. The goodbye page signs this device out once it
    // has rendered: signing out here, while Settings is still on screen,
    // would let the login redirect for protected pages win the race.
    navigate('/goodbye', { replace: true, state: { accountDeleted: true, demo: ACCOUNT_DELETION_IS_DEMO } })
  }

  const hasOpenTrades = open.offers + open.agreements > 0
  const openParts = [
    open.offers > 0 && plural(open.offers, 'open offer', 'open offers'),
    open.agreements > 0 && plural(open.agreements, 'trade agreement in progress', 'trade agreements in progress'),
  ].filter(Boolean)
  const seeParts = [
    open.offers > 0 && (open.offers === 1 ? 'the offer as withdrawn' : 'the offers as withdrawn'),
    open.agreements > 0 && (open.agreements === 1 ? 'the agreement as canceled' : 'the agreements as canceled'),
  ].filter(Boolean)

  const wordHelper = !wordMatches
    ? 'The button turns on once this matches.'
    : identityReady
      ? 'Ready when you are.'
      : method?.kind === 'oauth'
        ? `Confirm with ${method.provider.label} above too.`
        : 'Enter your password above too.'

  return (
    <Modal
      onClose={close}
      align="sheet"
      labelledBy={titleId}
      className="sm:max-w-lg"
      // Pinned below the scrolling details, so both choices are in reach
      // without scrolling on a phone
      footer={
        <div className="flex flex-col-reverse gap-1.5 sm:flex-row sm:gap-3">
          <Button type="button" variant="ghost" onClick={close} disabled={busy || leaving} className="sm:flex-1">
            Keep my account
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={!ready} loading={busy} className="sm:flex-1">
            {busy ? 'Deleting…' : 'Delete account'}
          </Button>
        </div>
      }
    >
      <h2 id={titleId} className="font-display text-xl font-semibold text-ink">
        Delete your account?
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        This can’t be undone. When you delete your account, we:
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-snug text-ink-2 marker:text-muted sm:space-y-1.5 sm:leading-relaxed">
        <li>Delete your sign-in details, profile photo, bio, interests, notifications and notification settings.</li>
        <li>Delete listings nobody has made an offer on, and take down and clear the rest.</li>
        <li>Delete the listing photos you uploaded.</li>
        <li>Withdraw your open offers and cancel trade agreements that aren’t finished.</li>
        <li>Show “Former neighbor” in place of your name on past trades and reviews.</li>
      </ul>

      <div className="mt-5 border-l-2 border-clay-mid bg-clay-light/50 px-4 py-3 text-sm leading-relaxed text-ink-2">
        {hasOpenTrades ? (
          <>
            You have {openParts.join(' and ')} with {listNames(open.names)}. They’ll see {seeParts.join(' and ')},
            from “Former neighbor”. If you can, let them know first.
          </>
        ) : (
          <>Neighbors you’ve traded with will see “Former neighbor” in place of your name.</>
        )}{' '}
        Messages you sent stay in their conversations.
      </div>

      {ACCOUNT_DELETION_IS_DEMO && (
        <p className="mt-4 text-small text-muted">
          This is the demo, so nothing is deleted: you’ll just be logged out.
          {method?.kind === 'password' && ' Any password works.'}
        </p>
      )}

      <form
        id={formId}
        className="mt-6 space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          void handleDelete()
        }}
      >
        <fieldset className="space-y-3" disabled={busy}>
          <legend className="mb-3 text-label text-ink">Confirm it’s you</legend>
          {method?.kind === 'password' && (
            <Input
              id={passwordId}
              label="Your password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setPasswordError(null)
              }}
              error={passwordError ?? undefined}
              helperText="The one you use to log in to Bartrrr."
            />
          )}
          {method?.kind === 'oauth' &&
            (oauthConfirmed ? (
              <p className="flex items-center gap-2 text-sm text-ink-2">
                <Check className="h-4 w-4 text-moss" aria-hidden="true" />
                Confirmed with {method.provider.label}.
              </p>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-ink-2">
                  We’ll send you to {method.provider.label} and bring you back here.
                </p>
                <SocialAuthButton
                  provider={method.provider.id}
                  loading={leaving}
                  onClick={() => void handleConfirmWithProvider()}
                >
                  Confirm with {method.provider.label}
                </SocialAuthButton>
              </>
            ))}
          {method === undefined && <p className="text-sm text-muted">Checking how you log in…</p>}
        </fieldset>

        <Input
          id={inputId}
          label={`Type ${CONFIRM_WORD} to confirm`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={busy}
          helperText={wordHelper}
        />

        {error && (
          <p role="alert" className="border border-clay/40 bg-paper px-4 py-3 text-sm leading-relaxed text-clay-dark">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
