import { cn } from '@/lib/utils'

export interface ChipProps {
  label: string
  selected?: boolean
  onToggle?: () => void
  className?: string
}

export function Chip({ label, selected = false, onToggle, className }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay',
        selected
          ? 'bg-clay text-white'
          : 'bg-white border border-sand text-ink-2 hover:bg-sand-light hover:border-clay-mid',
        className,
      )}
    >
      {label}
    </button>
  )
}
