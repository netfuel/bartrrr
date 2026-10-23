import { useId } from 'react'
import { Button, type ButtonProps } from './Button'
import { Modal } from './Modal'

export interface ConfirmDialogProps {
  title: string
  /** What happens next, in plain words. Say if it can't be undone. */
  description: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  confirmVariant?: ButtonProps['variant']
  onConfirm: () => void
  onClose: () => void
}

/**
 * Confirmation step for irreversible or high-stakes actions
 * (accept a trade, withdraw a listing, mark a trade as done).
 * The confirm button names the action; cancel is always the safe default.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Not yet',
  confirmVariant = 'primary',
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descId = useId()

  return (
    <Modal onClose={onClose} align="sheet" labelledBy={titleId}>
      <h2 id={titleId} className="font-display text-lg font-semibold text-ink mb-2">
        {title}
      </h2>
      <div id={descId} className="text-sm text-muted leading-relaxed mb-6">
        {description}
      </div>
      <div className="flex gap-3">
        <Button variant="ghost" onClick={onClose} className="flex-1">
          {cancelLabel}
        </Button>
        <Button variant={confirmVariant} onClick={onConfirm} className="flex-1" aria-describedby={descId}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
