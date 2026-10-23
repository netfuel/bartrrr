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
      {/* Abstract mark-making in the earth palette (see style guide §10) */}
      <div className="relative mb-7 h-24 w-32" aria-hidden="true">
        <svg viewBox="0 0 128 96" className="absolute inset-0 h-full w-full">
          <path d="M14 58c14-20 34-30 58-28s38 12 44 22" fill="none" stroke="var(--color-clay)" strokeOpacity="0.55" strokeWidth="9" strokeLinecap="round" />
          <path d="M22 74c20-6 44-8 66-2" fill="none" stroke="var(--color-gold)" strokeOpacity="0.45" strokeWidth="6" strokeLinecap="round" />
          <path d="M40 30c10-10 26-14 40-8" fill="none" stroke="var(--color-forest-mid)" strokeOpacity="0.6" strokeWidth="5" strokeLinecap="round" />
          <circle cx="98" cy="22" r="6" fill="var(--color-moss)" fillOpacity="0.45" />
        </svg>
        {icon && (
          <div className="absolute inset-0 flex items-center justify-center text-ink [&_svg]:h-7 [&_svg]:w-7">
            {icon}
          </div>
        )}
      </div>
      <h2 className="font-display text-[28px] font-normal leading-tight tracking-[-0.015em] text-ink mb-3">
        {title}
      </h2>
      <p className="text-base text-ink-2 max-w-sm mb-7 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
