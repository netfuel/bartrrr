import { cn } from '@/lib/utils'

export interface WordmarkProps {
  className?: string
}

/**
 * The bartrrr wordmark: Fraunces roman with the rolled "rrr" set in the
 * soft italic, in clay — the one flourish in an otherwise quiet system.
 */
export function Wordmark({ className }: WordmarkProps) {
  return (
    <span
      className={cn(
        'font-display inline-flex items-baseline text-[24px] font-normal leading-none tracking-[-0.02em] text-ink',
        className,
      )}
    >
      bart<em className="serif-italic pr-[0.04em] text-clay">rrr</em>
    </span>
  )
}
