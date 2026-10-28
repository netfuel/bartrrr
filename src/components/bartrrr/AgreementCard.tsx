import { useId, useState } from 'react'
import { ArrowLeftRight, Check, Flag, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, Button, Badge } from '@/components/ui'
import { AGREEMENT_STATUS_LABELS, type TradeAgreement, type UserProfile } from '@/types'
import { isBeingAgreed, listPhrase, missingDetails } from '@/lib/agreements'

export interface AgreementCardProps {
  agreement: TradeAgreement
  partyA: UserProfile
  partyB: UserProfile
  currentUserId?: string
  onSign?: () => void
  className?: string
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const statusBadgeVariant: Record<string, 'teal' | 'gold' | 'clay' | 'moss' | 'active' | 'closed'> = {
  draft: 'gold',
  under_review: 'gold',
  pending_signatures: 'gold',
  active: 'active',
  completed: 'moss',
  cancelled: 'closed',
  disputed: 'clay',
}

export function AgreementCard({
  agreement,
  partyA,
  partyB,
  currentUserId,
  onSign,
  className,
}: AgreementCardProps) {
  const [acknowledged, setAcknowledged] = useState(false)
  const ackId = useId()
  const bothSigned = agreement.partyA.signed && agreement.partyB.signed
  const isPartyA = currentUserId === agreement.partyA.userId
  const isParticipant = currentUserId === agreement.partyA.userId || currentUserId === agreement.partyB.userId
  const hasSigned = isPartyA ? agreement.partyA.signed : agreement.partyB.signed
  const open = isBeingAgreed(agreement)
  const missing = open ? missingDetails(agreement) : []

  // Speak from the reader's perspective when they're part of the trade
  const you = isPartyA
    ? { user: partyA, item: agreement.partyA.item, signed: agreement.partyA.signed }
    : { user: partyB, item: agreement.partyB.item, signed: agreement.partyB.signed }
  const them = isPartyA
    ? { user: partyB, item: agreement.partyB.item, signed: agreement.partyB.signed }
    : { user: partyA, item: agreement.partyA.item, signed: agreement.partyA.signed }

  const rows = isParticipant
    ? [
        { label: 'You give', giver: you.user, item: you.item },
        { label: 'You get', giver: them.user, item: them.item },
      ]
    : [
        { label: `${partyA.displayName} provides`, giver: partyA, item: agreement.partyA.item },
        { label: `${partyB.displayName} provides`, giver: partyB, item: agreement.partyB.item },
      ]

  return (
    <article
      className={cn(
        'paper relative overflow-hidden border border-ink',
        className,
      )}
    >
      {/* Document head */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink px-5 py-4 sm:px-7">
        <h3 className="font-display text-[22px] font-normal tracking-[-0.012em] text-ink">
          Trade agreement
        </h3>
        <Badge variant={statusBadgeVariant[agreement.status]}>
          {AGREEMENT_STATUS_LABELS[agreement.status]}
        </Badge>
      </header>

      {/* Trade rows — the two halves of the exchange */}
      <div className="relative">
        {rows.map(({ label, giver, item }, i) => (
          <div
            key={label}
            className={cn('flex items-start gap-4 px-5 py-5 sm:px-7', i === 0 && 'border-b border-dashed border-ink/30')}
          >
            <Avatar
              src={giver.avatarUrl}
              name={giver.displayName}
              userId={giver.id}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <p className={cn('text-label', i === 0 ? 'text-clay-dark' : 'text-forest')}>{label}</p>
              <p className="mt-1 font-display text-[19px] leading-[1.3] tracking-[-0.008em] text-ink line-clamp-2">{item}</p>
            </div>
          </div>
        ))}
        <span
          aria-hidden="true"
          className="absolute right-5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-ink bg-paper text-ink sm:right-7"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </span>
      </div>

      {/* Signature lines */}
      <div className="grid grid-cols-2 border-t border-ink">
        {[
          { user: partyA, signed: agreement.partyA.signed },
          { user: partyB, signed: agreement.partyB.signed },
        ].map(({ user, signed }, i) => (
          <div key={user.id} className={cn('px-5 pt-5 pb-4 sm:px-7', i === 0 && 'border-r border-ink/30')}>
            <div className="flex h-9 items-end border-b border-ink/50 pb-1">
              {signed ? (
                <span className="animate-fade-in font-display text-[24px] italic leading-none text-ink">
                  {user.displayName.split(' ')[0]}
                </span>
              ) : (
                <span aria-hidden="true" className="text-small text-muted/80">&nbsp;</span>
              )}
            </div>
            <p
              className={cn('mt-2 flex items-center gap-1.5 text-small', signed ? 'text-teal-dark font-medium' : 'text-muted')}
            >
              {signed && <Check className="h-3.5 w-3.5" />}
              {currentUserId === user.id ? 'You' : user.displayName.split(' ')[0]}
              {signed ? ' signed' : currentUserId === user.id ? " haven't signed yet" : " hasn't signed yet"}
            </p>
          </div>
        ))}
      </div>

      {/* Time and place still to settle (signing waits on these) */}
      {missing.length > 0 && !(onSign && isParticipant && !hasSigned) && (
        <p className="border-t border-ink/30 bg-gold-light/60 px-5 py-3 text-small text-ink-2 sm:px-7">
          <span className="font-medium text-ink">Still needed:</span> {listPhrase(missing)}
        </p>
      )}

      {/* CTA */}
      {open && !hasSigned && onSign && isParticipant && missing.length > 0 && (
        <div className="border-t border-ink px-5 py-5 sm:px-7">
          <Button variant="confirm" size="lg" disabled className="w-full">
            <Check className="h-5 w-5" /> Sign agreement
          </Button>
          <p className="text-small text-ink-2 text-center mt-3">
            {capitalize(listPhrase(missing))} {missing.length === 1 ? 'is' : 'are'} still needed.
            Add {missing.length === 1 ? 'it' : 'them'} below before you sign.
          </p>
        </div>
      )}

      {open && !hasSigned && onSign && isParticipant && missing.length === 0 && (
        <div className="border-t border-ink px-5 py-5 sm:px-7">
          <label htmlFor={ackId} className="flex items-start gap-3 mb-4 text-[15px] text-ink-2 cursor-pointer">
            <input
              id={ackId}
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1 w-4 h-4 accent-clay shrink-0"
            />
            <span>
              I've described what I'm giving honestly, including its condition, and I agree to
              these terms.
            </span>
          </label>
          <Button variant="confirm" size="lg" onClick={onSign} disabled={!acknowledged} className="w-full">
            <Check className="h-5 w-5" /> Sign agreement
          </Button>
          <p className="text-small text-muted text-center mt-3">
            {acknowledged
              ? "Signing isn't a legal contract. It's a shared record of what you both agreed to."
              : 'Check the box above to sign.'}
          </p>
        </div>
      )}

      {open && !bothSigned && hasSigned && (
        <p className="border-t border-ink/30 px-5 py-4 text-center text-[15px] text-ink-2 sm:px-7">
          You signed. Waiting for {them.user.displayName.split(' ')[0]} to sign. We'll let you know.
        </p>
      )}

      {agreement.status === 'cancelled' && (
        <div className="flex items-center justify-center gap-2 border-t border-ink/30 bg-sand-light px-5 py-4 text-ink-2 font-medium text-base">
          <X className="h-5 w-5" />
          This trade was canceled.
        </div>
      )}

      {agreement.status === 'disputed' && (
        <div className="flex items-center justify-center gap-2 border-t border-clay bg-clay-light px-5 py-4 text-clay-dark font-medium text-base">
          <Flag className="h-5 w-5" />
          Flagged for review
        </div>
      )}

      {bothSigned && (agreement.status === 'active' || agreement.status === 'completed') && (
        <div className="flex items-center justify-center gap-2 border-t border-teal bg-teal-light px-5 py-4 text-teal-dark font-medium text-base animate-scale-in">
          <Check className="h-5 w-5" />
          You both signed. Time to swap!
        </div>
      )}
    </article>
  )
}
