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
      aria-pressed={selected}
      className={cn(
        'pressable inline-flex items-center min-h-[40px] rounded-full px-4 py-1.5 text-[15px] font-medium transition-[background-color,border-color,color,transform,box-shadow] duration-200',
        selected
          ? 'bg-ink text-cream border border-ink'
          : 'bg-transparent border border-ink text-ink hover:bg-ink hover:text-cream',
        className,
      )}
    >
      {label}
    </button>
  )
}
