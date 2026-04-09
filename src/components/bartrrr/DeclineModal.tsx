import { useState } from 'react'
import { X } from 'lucide-react'
import { Button, Chip, Textarea } from '@/components/ui'
import { DECLINE_REASON_LABELS, type OfferDeclineReason } from '@/types'

export interface DeclineModalProps {
  onDecline: (reason: OfferDeclineReason, note?: string) => void
  onClose: () => void
}

const reasons = Object.entries(DECLINE_REASON_LABELS) as [
  OfferDeclineReason,
  string,
][]

export function DeclineModal({ onDecline, onClose }: DeclineModalProps) {
  const [selectedReason, setSelectedReason] =
    useState<OfferDeclineReason | null>(null)
  const [note, setNote] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-t-xl sm:rounded-xl w-full max-w-md p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold">
            Decline this offer?
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-sand-light transition-colors"
          >
            <X className="h-5 w-5 text-muted" />
          </button>
        </div>

        <p className="text-sm text-muted mb-4">
          Let them know why so they can make a better offer next time.
        </p>

        {/* Reason chips */}
        <div className="flex flex-wrap gap-2 mb-4">
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

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!selectedReason}
            onClick={() => selectedReason && onDecline(selectedReason, note || undefined)}
            className="flex-1"
          >
            Decline
          </Button>
        </div>
      </div>
    </div>
  )
}
