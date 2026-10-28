import { useEffect, useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Modal } from '@/components/ui'
import { useAuth } from '@/providers/AuthProvider'
import { useUsersStore } from '@/stores'
import { useAgreementsForUser, useOffersForUser } from '@/stores/selectors'
import { ACCOUNT_DELETION_IS_DEMO, AccountDeletionError, deleteMyAccount } from '@/lib/account-deletion'
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

function errorCopy(err: unknown) {
  const kind = err instanceof AccountDeletionError ? err.kind : 'server'
  if (kind === 'network') {
    return 'We couldn’t reach Bartrrr, so your account is still here. Check your connection and try again.'
  }
  if (kind === 'session') {
    return 'Your sign-in has expired, so your account is still here. Log out, log back in, then try again from Settings.'
  }
  return `Something went wrong on our end, and your account is still here. Try again in a moment, or email ${LEGAL_CONTACT_EMAIL} and we’ll delete it for you.`
}

/**
 * Settings → Delete account. Kept in its own component so the rest of
 * Settings can change without touching this flow.
 */
export function DeleteAccountSection() {
  const [open, setOpen] = useState(false)

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
        <Button variant="outline" onClick={() => setOpen(true)}>
          Delete account
        </Button>
      </div>
      {open && <DeleteAccountDialog onClose={() => setOpen(false)} />}
    </section>
  )
}

function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const users = useUsersStore((s) => s.users)
  const offers = useOffersForUser(currentUser?.id)
  const agreements = useAgreementsForUser(currentUser?.id)

  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleId = useId()
  const inputId = useId()

  // Load the goodbye page now, so it can show even if the connection drops
  // right after the account is deleted
  useEffect(() => {
    void import('@/pages/GoodbyePage')
  }, [])

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

  const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD
  const close = () => {
    if (!busy) onClose()
  }

  const handleDelete = async () => {
    if (!confirmed || busy) return
    setBusy(true)
    setError(null)
    try {
      await deleteMyAccount(currentUser.id)
    } catch (err) {
      setError(errorCopy(err))
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

  return (
    <Modal onClose={close} align="sheet" labelledBy={titleId} className="sm:max-w-lg">
      <h2 id={titleId} className="font-display text-xl font-semibold text-ink">
        Delete your account?
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        This can’t be undone. When you delete your account, we:
      </p>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2 marker:text-muted">
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
        </p>
      )}

      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault()
          void handleDelete()
        }}
      >
        <Input
          id={inputId}
          label={`Type ${CONFIRM_WORD} to confirm`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={busy}
          helperText={confirmed ? 'Ready when you are.' : 'The button turns on once this matches.'}
        />

        {error && (
          <p role="alert" className="mt-4 border border-clay/40 bg-paper px-4 py-3 text-sm leading-relaxed text-clay-dark">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <Button type="button" variant="ghost" onClick={close} disabled={busy} className="sm:flex-1">
            Keep my account
          </Button>
          <Button type="submit" variant="primary" disabled={!confirmed} loading={busy} className="sm:flex-1">
            {busy ? 'Deleting…' : 'Delete account'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
