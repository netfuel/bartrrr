import { useId, useState } from 'react'
import { Button, Modal, Textarea } from '@/components/ui'
import { disputeReasonSchema } from '@/lib/validation'

export interface FlagTradeDialogProps {
  otherName: string
  /** Completed trades: reviews pause. Active trades: can't be marked done. */
  completed: boolean
  onFlag: (reason: string) => void
  onClose: () => void
}

/** Flag a trade for review (PRD dispute clause). A short reason is required. */
export function FlagTradeDialog({ otherName, completed, onFlag, onClose }: FlagTradeDialogProps) {
  const titleId = useId()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string>()

  const handleFlag = () => {
    const result = disputeReasonSchema.safeParse(reason)
    if (!result.success) {
      setError(result.error.issues[0]?.message)
      return
    }
    onFlag(result.data)
  }

  return (
    <Modal onClose={onClose} align="sheet" labelledBy={titleId}>
      <h2 id={titleId} className="font-display text-[26px] font-normal tracking-[-0.015em] text-ink mb-3">
        Flag this trade for review?
      </h2>
      <div className="space-y-3 text-[15px] text-ink-2 leading-relaxed mb-5">
        <p>
          The trade is marked as flagged for both of you, and we'll let {otherName} know what you
          wrote. {completed
            ? "New reviews are paused while it's flagged."
            : "While it's flagged, neither of you can mark it done."}
        </p>
        <p>
          Bartrrr keeps the record of what you agreed to and can help you two talk, but it
          can't decide who's right or guarantee an outcome. This can't be undone from the app.
        </p>
      </div>

      <Textarea
        id="flag-reason"
        label="What went wrong?"
        placeholder="The mixer was missing its whisk attachment."
        value={reason}
        maxLength={500}
        rows={3}
        onChange={(e) => {
          setReason(e.target.value)
          setError(undefined)
        }}
        error={error}
        helperText={`${reason.trim().length} of 500 characters. ${otherName} will see this.`}
      />

      <div className="flex gap-3 mt-6">
        <Button variant="ghost" onClick={onClose} className="flex-1">
          Not now
        </Button>
        <Button variant="primary" onClick={handleFlag} className="flex-1">
          Flag trade
        </Button>
      </div>
    </Modal>
  )
}
