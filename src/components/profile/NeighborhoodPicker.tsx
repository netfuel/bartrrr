import { cn } from '@/lib/utils'
import { NEIGHBORHOODS } from '@/data/neighborhoods'

export interface NeighborhoodPickerProps {
  value: string
  onChange: (neighborhood: string) => void
  /** A saved neighborhood that isn't on the list, shown as its own tile so it stays visible */
  legacy?: string
  /** id of the element that labels the group */
  labelledBy?: string
  describedBy?: string
  className?: string
}

/** A grid of the Memphis neighborhoods we know, one tap to choose. */
export function NeighborhoodPicker({
  value,
  onChange,
  legacy,
  labelledBy,
  describedBy,
  className,
}: NeighborhoodPickerProps) {
  const options = legacy ? [...NEIGHBORHOODS, legacy] : NEIGHBORHOODS
  return (
    <div
      role="group"
      aria-label={labelledBy ? undefined : 'Neighborhood'}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={cn('grid grid-cols-2 sm:grid-cols-3 border-t border-l border-ink', className)}
    >
      {options.map((n) => {
        const selected = value === n
        const isLegacy = n === legacy
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={selected}
            className={cn(
              'pressable min-h-[60px] px-4 py-3 rounded-none border-b border-r border-ink text-[15px] font-medium text-left transition-colors duration-300',
              selected ? 'bg-ink text-cream' : 'text-ink hover:bg-paper',
            )}
          >
            {n}
            {isLegacy && (
              <span className={cn('text-label mt-1 block text-[10px]', selected ? 'text-cream/70' : 'text-muted')}>
                Not on our map
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
