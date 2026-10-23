import { cn } from '@/lib/utils'

export interface CardProps {
  children: React.ReactNode
  padding?: boolean
  /** Hover lift + press feedback for clickable cards */
  interactive?: boolean
  className?: string
  onClick?: () => void
}

export function Card({ children, padding = true, interactive = false, className, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'border border-ink bg-cream overflow-hidden',
        padding && 'p-6',
        interactive &&
          'pressable cursor-pointer transition-[background-color,transform] duration-300 ease-out-soft hover:bg-sand-light',
        className,
      )}
    >
      {children}
    </div>
  )
}
