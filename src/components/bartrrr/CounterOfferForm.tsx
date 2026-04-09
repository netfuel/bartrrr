import { useState } from 'react'
import { Button, Textarea } from '@/components/ui'

export interface CounterOfferFormProps {
  onSubmit: (content: string, items: string[]) => void
  onCancel: () => void
}

export function CounterOfferForm({ onSubmit, onCancel }: CounterOfferFormProps) {
  const [items, setItems] = useState('')
  const [message, setMessage] = useState('')

  const parsedItems = items
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

  const handleSubmit = () => {
    if (parsedItems.length === 0) return
    onSubmit(message || 'Here is my counter offer', parsedItems)
  }

  return (
    <div className="bg-white rounded-lg border border-sand p-4 space-y-3">
      <p className="text-sm font-medium text-ink">Counter offer</p>

      <Textarea
        label="What are you offering instead?"
        placeholder="List your items (one per line)..."
        value={items}
        onChange={(e) => setItems(e.target.value)}
        rows={3}
      />

      <Textarea
        label="Message (optional)"
        placeholder="Explain your counter..."
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
          Send counter
        </Button>
      </div>
    </div>
  )
}
