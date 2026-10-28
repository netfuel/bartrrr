import { useId, useState } from 'react'
import { Button, Chip, Input, Textarea } from '@/components/ui'
import { exchangeDetailsSchema } from '@/lib/validation'
import { fromLocalInputValue, toLocalInputValue } from '@/lib/agreements'
import { EXCHANGE_METHOD_LABELS, type ExchangeDetails, type ExchangeMethod } from '@/types'

export interface ExchangeDetailsFormProps {
  initial: ExchangeDetails
  /** Someone has signed: saving clears signatures, so say so */
  anySigned: boolean
  otherName: string
  onSave: (details: ExchangeDetails) => void
  onCancel: () => void
}

const methods = Object.entries(EXCHANGE_METHOD_LABELS) as [ExchangeMethod, string][]

type Field = 'exchangeMethod' | 'exchangeDate' | 'exchangeLocation' | 'specialInstructions'

/**
 * How, when and where the swap happens. Lives on the agreement and is
 * editable by either neighbor until both have signed.
 */
export function ExchangeDetailsForm({ initial, anySigned, otherName, onSave, onCancel }: ExchangeDetailsFormProps) {
  const [method, setMethod] = useState<ExchangeMethod | undefined>(initial.exchangeMethod)
  const [when, setWhen] = useState(toLocalInputValue(initial.exchangeDate))
  const [place, setPlace] = useState(initial.exchangeLocation ?? '')
  const [notes, setNotes] = useState(initial.specialInstructions ?? '')
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const methodLabelId = useId()
  // Earliest pickable time: now, to the minute (render-time snapshot is fine)
  const [minWhen] = useState(() => toLocalInputValue(new Date().toISOString()))

  const clear = (field: Field) => setErrors((e) => ({ ...e, [field]: undefined }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const exchangeDate = fromLocalInputValue(when)
    if (when && !exchangeDate) {
      setErrors({ exchangeDate: 'Pick a date and time for the swap.' })
      return
    }
    const result = exchangeDetailsSchema.safeParse({
      exchangeMethod: method,
      exchangeDate,
      exchangeLocation: place,
      specialInstructions: notes,
    })
    if (!result.success) {
      const next: Partial<Record<Field, string>> = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0] as Field
        next[field] ??= issue.message
      }
      setErrors(next)
      return
    }
    onSave({
      exchangeMethod: result.data.exchangeMethod,
      exchangeDate: result.data.exchangeDate,
      exchangeLocation: result.data.exchangeLocation || undefined,
      specialInstructions: result.data.specialInstructions || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="paper border border-ink px-5 py-6 sm:px-7 space-y-6">
      <div>
        <p id={methodLabelId} className="text-label text-ink-2 mb-2">How you'll swap</p>
        <div role="group" aria-labelledby={methodLabelId} className="flex flex-wrap gap-2">
          {methods.map(([key, label]) => (
            <Chip key={key} label={label} selected={method === key} onToggle={() => setMethod(key)} />
          ))}
        </div>
      </div>

      <Input
        id="exchange-when"
        label="Date and time"
        type="datetime-local"
        value={when}
        min={minWhen}
        onChange={(e) => {
          setWhen(e.target.value)
          clear('exchangeDate')
        }}
        error={errors.exchangeDate}
        helperText="Shown in your time zone."
      />

      <Input
        id="exchange-place"
        label="Place"
        value={place}
        maxLength={300}
        placeholder="Cossitt Library, front steps"
        onChange={(e) => {
          setPlace(e.target.value)
          clear('exchangeLocation')
        }}
        error={errors.exchangeLocation}
        helperText="A public spot like a library, coffee shop, or community center is a good bet. Don't put a home address here."
      />

      <Textarea
        id="exchange-notes"
        label="Notes (optional)"
        value={notes}
        maxLength={1000}
        rows={3}
        placeholder="Bring a box, it's heavy."
        onChange={(e) => {
          setNotes(e.target.value)
          clear('specialInstructions')
        }}
        error={errors.specialInstructions}
      />

      {anySigned && (
        <p className="border-l-2 border-gold bg-gold-light/70 px-4 py-3 text-small text-ink-2 leading-relaxed">
          Saving clears both signatures, so you and {otherName} will both sign again.
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Keep current details
        </Button>
        <Button type="submit" variant="primary">
          Save changes
        </Button>
      </div>
    </form>
  )
}
