import { cn } from '@/lib/utils'
import { Button } from './Button'

export interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  icon?: React.ReactNode
  className?: string
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'animate-fade-up flex flex-col items-center justify-center text-center py-16 px-6',
        className,
      )}
    >
      {icon && (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-sand-light text-muted">
          {icon}
        </div>
      )}
      <h2 className="font-display text-2xl font-semibold text-ink mb-2">
        {title}
      </h2>
      <p className="text-base text-muted max-w-sm mb-6 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
