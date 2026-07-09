import { ArrowLeftRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, Button, Badge } from '@/components/ui'
import type { TradeAgreement, UserProfile } from '@/types'

export interface AgreementCardProps {
  agreement: TradeAgreement
  partyA: UserProfile
  partyB: UserProfile
  currentUserId?: string
  onSign?: () => void
  className?: string
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  under_review: 'Under Review',
  pending_signatures: 'Waiting for signatures',
  active: 'Ready to swap',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
}

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
  const bothSigned = agreement.partyA.signed && agreement.partyB.signed
  const isPartyA = currentUserId === agreement.partyA.userId
  const isParticipant = currentUserId === agreement.partyA.userId || currentUserId === agreement.partyB.userId
  const hasSigned = isPartyA ? agreement.partyA.signed : agreement.partyB.signed

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
    <div
      className={cn(
        'rounded-lg p-6 overflow-hidden shadow-soft',
        bothSigned ? 'bg-teal-light' : 'bg-forest-light',
        className,
      )}
    >
      {/* Status badge */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-xl font-semibold text-ink">
          Trade Agreement
        </h3>
        <Badge variant={statusBadgeVariant[agreement.status]}>
          {statusLabels[agreement.status]}
        </Badge>
      </div>

      {/* Trade rows */}
      <div className="space-y-3">
        {rows.map(({ label, giver, item }) => (
          <div key={label} className="flex items-center gap-3 bg-white/70 rounded-md p-4">
            <Avatar
              src={giver.avatarUrl}
              name={giver.displayName}
              userId={giver.id}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <p className="text-label text-muted">{label}</p>
              <p className="text-base font-medium text-ink truncate">{item}</p>
            </div>
            <ArrowLeftRight className="h-5 w-5 text-forest shrink-0" />
          </div>
        ))}
      </div>

      {/* Signature status */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-5 text-[15px]">
        {[
          { user: partyA, signed: agreement.partyA.signed },
          { user: partyB, signed: agreement.partyB.signed },
        ].map(({ user, signed }) => (
          <span
            key={user.id}
            className={cn('flex items-center gap-1.5', signed ? 'text-teal-dark font-medium' : 'text-muted')}
          >
            {signed && <Check className="h-4 w-4" />}
            {currentUserId === user.id ? 'You' : user.displayName.split(' ')[0]}
            {signed ? ' signed' : ' — not signed yet'}
          </span>
        ))}
      </div>

      {/* CTA */}
      {!bothSigned && !hasSigned && onSign && isParticipant && (
        <div className="mt-5">
          <Button variant="confirm" size="lg" onClick={onSign} className="w-full">
            <Check className="h-5 w-5" /> I agree to this trade
          </Button>
          <p className="text-small text-muted text-center mt-2">
            Signing just means you both agree to the terms above.
          </p>
        </div>
      )}

      {!bothSigned && hasSigned && (
        <p className="mt-5 text-center text-[15px] text-ink-2">
          You've signed. Waiting for {them.user.displayName.split(' ')[0]} to sign.
        </p>
      )}

      {bothSigned && (
        <div className="mt-5 flex items-center justify-center gap-2 text-teal-dark font-semibold text-base animate-scale-in">
          <Check className="h-5 w-5" />
          You both agreed — time to swap!
        </div>
      )}
    </div>
  )
}
