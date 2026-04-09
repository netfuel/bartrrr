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
  pending_signatures: 'Pending Signatures',
  active: 'Active',
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
  const currentParty =
    currentUserId === agreement.partyA.userId ? 'A' : 'B'
  const hasSigned =
    currentParty === 'A' ? agreement.partyA.signed : agreement.partyB.signed

  return (
    <div
      className={cn(
        'rounded-lg p-6 overflow-hidden',
        bothSigned ? 'bg-teal-light' : 'bg-forest-light',
        className,
      )}
    >
      {/* Status badge */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-semibold text-ink">
          Trade Agreement
        </h3>
        <Badge variant={statusBadgeVariant[agreement.status]}>
          {statusLabels[agreement.status]}
        </Badge>
      </div>

      {/* Trade direction rows */}
      <div className="space-y-3">
        {/* Party A gives */}
        <div className="flex items-center gap-3 bg-white/60 rounded-md p-3">
          <Avatar
            src={partyA.avatarUrl}
            name={partyA.displayName}
            userId={partyA.id}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted">{partyA.displayName} provides</p>
            <p className="text-sm font-medium text-ink truncate">
              {agreement.partyA.item}
            </p>
          </div>
          <ArrowLeftRight className="h-4 w-4 text-forest shrink-0" />
          <Avatar
            src={partyB.avatarUrl}
            name={partyB.displayName}
            userId={partyB.id}
            size="md"
          />
        </div>

        {/* Party B gives */}
        <div className="flex items-center gap-3 bg-white/60 rounded-md p-3">
          <Avatar
            src={partyB.avatarUrl}
            name={partyB.displayName}
            userId={partyB.id}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted">{partyB.displayName} provides</p>
            <p className="text-sm font-medium text-ink truncate">
              {agreement.partyB.item}
            </p>
          </div>
          <ArrowLeftRight className="h-4 w-4 text-forest shrink-0" />
          <Avatar
            src={partyA.avatarUrl}
            name={partyA.displayName}
            userId={partyA.id}
            size="md"
          />
        </div>
      </div>

      {/* Signature status */}
      <div className="flex items-center gap-4 mt-4 text-xs">
        <span className={cn('flex items-center gap-1', agreement.partyA.signed ? 'text-teal-dark' : 'text-muted')}>
          {agreement.partyA.signed && <Check className="h-3 w-3" />}
          {partyA.displayName}: {agreement.partyA.signed ? 'Signed' : 'Pending'}
        </span>
        <span className={cn('flex items-center gap-1', agreement.partyB.signed ? 'text-teal-dark' : 'text-muted')}>
          {agreement.partyB.signed && <Check className="h-3 w-3" />}
          {partyB.displayName}: {agreement.partyB.signed ? 'Signed' : 'Pending'}
        </span>
      </div>

      {/* CTA */}
      {!bothSigned && !hasSigned && onSign && (
        <div className="mt-4">
          <Button variant="confirm" onClick={onSign} className="w-full">
            Sign agreement
          </Button>
        </div>
      )}

      {bothSigned && (
        <div className="mt-4 flex items-center justify-center gap-2 text-teal-dark font-semibold text-sm">
          <Check className="h-4 w-4" />
          Agreement confirmed
        </div>
      )}
    </div>
  )
}
