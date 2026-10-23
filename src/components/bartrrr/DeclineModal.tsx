import { useState } from 'react'
import { X } from 'lucide-react'
import { Button, Chip, Textarea, Modal } from '@/components/ui'
import { DECLINE_REASON_LABELS, type OfferDeclineReason } from '@/types'

export interface DeclineModalProps {
  onDecline: (reason: OfferDeclineReason, note?: string) => void
  onClose: () => void
  /** First name of the neighbor who made the offer */
  otherName?: string
}

const reasons = Object.entries(DECLINE_REASON_LABELS) as [
  OfferDeclineReason,
  string,
][]

export function DeclineModal({ onDecline, onClose, otherName = 'your neighbor' }: DeclineModalProps) {
  const [selectedReason, setSelectedReason] =
    useState<OfferDeclineReason | null>(null)
  const [note, setNote] = useState('')

  return (
    <Modal onClose={onClose} align="sheet" labelledBy="decline-modal-title">
        <div className="flex items-center justify-between mb-4">
          <h3 id="decline-modal-title" className="font-display text-lg font-semibold">
            Decline this offer?
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-full hover:bg-sand-light transition-colors"
          >
            <X className="h-5 w-5 text-muted" />
          </button>
        </div>

        <p className="text-sm text-muted mb-4">
          This ends the negotiation. Pick a reason so {otherName} knows what to try next time.
        </p>

        {/* Reason chips */}
        <div role="group" aria-label="Reason for declining" className="flex flex-wrap gap-2 mb-4">
          {reasons.map(([key, label]) => (
            <Chip
              key={key}
              label={label}
              selected={selectedReason === key}
              onToggle={() => setSelectedReason(key)}
            />
          ))}
        </div>

        {/* Optional note */}
        <Textarea
          label="Add a note (optional)"
          placeholder="Anything else you'd like them to know?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />

        {!selectedReason && (
          <p className="text-small text-muted mt-4">Choose a reason to continue.</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Keep talking
          </Button>
          <Button
            variant="primary"
            disabled={!selectedReason}
            onClick={() => selectedReason && onDecline(selectedReason, note.trim() || undefined)}
            className="flex-1"
          >
            Decline offer
          </Button>
        </div>
    </Modal>
  )
}
