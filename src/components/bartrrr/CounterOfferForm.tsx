import { useState } from 'react'
import { Button, Textarea } from '@/components/ui'

export interface CounterOfferFormProps {
  onSubmit: (content: string, items: string[]) => void
  onCancel: () => void
  /** Items on the table right now; the form starts from these so a counter is an edit, not a blank slate */
  initialItems?: string[]
  /** First name of the other neighbor, for friendlier copy */
  otherName?: string
  /** True when this counter-offer uses the final round */
  isLastRound?: boolean
  /**
   * Counter items always describe what the offer-maker gives. The offer-maker
   * edits their own side; the listing owner edits what they'd want in return.
   */
  isOfferMaker?: boolean
}

export function CounterOfferForm({
  onSubmit,
  onCancel,
  initialItems = [],
  otherName = 'your neighbor',
  isLastRound = false,
  isOfferMaker = false,
}: CounterOfferFormProps) {
  const [items, setItems] = useState(initialItems.join('\n'))
  const [message, setMessage] = useState('')

  const parsedItems = items
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

  const handleSubmit = () => {
    if (parsedItems.length === 0) return
    onSubmit(message.trim() || 'Here’s a counter-offer.', parsedItems)
  }

  return (
    <div className="border border-ink bg-paper p-5 space-y-4">
      <p className="font-display text-[22px] text-ink">Counter-offer</p>
      <p className="text-small text-muted">
        Change what’s being traded and send it back to {otherName}.
        {isLastRound && ' This is the last counter-offer either of you can send.'}
      </p>

      <Textarea
        label={isOfferMaker ? 'What will you offer instead?' : `What would you want from ${otherName} instead?`}
        placeholder="One item or service per line"
        helperText={parsedItems.length === 0 ? 'Add at least one item or service to send a counter-offer.' : undefined}
        value={items}
        onChange={(e) => setItems(e.target.value)}
        rows={3}
      />

      <Textarea
        label="Message (optional)"
        placeholder="Say what you changed and why"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
      />

      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={parsedItems.length === 0}
          className="flex-1"
        >
          Send counter-offer
        </Button>
      </div>
    </div>
  )
}
