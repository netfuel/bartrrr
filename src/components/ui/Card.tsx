import { cn } from '@/lib/utils'

export interface CardProps {
  children: React.ReactNode
  padding?: boolean
  className?: string
}

export function Card({ children, padding = true, className }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg bg-white shadow-sm overflow-hidden',
        padding && 'p-6',
        className,
      )}
    >
      {children}
    </div>
  )
}
