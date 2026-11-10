import { cn } from '@/lib/utils'
import { charCount, formatCharCount } from '@/lib/utils/char-limit'

/** "450 of 500 characters", counted the way the database counts (T-66). */
export function CharCounter({
  id,
  value,
  limit,
  className,
}: {
  id?: string
  value: unknown
  limit: number
  className?: string
}) {
  const count = charCount(String(value ?? ''))
  return (
    <p id={id} className={cn('text-small tabular-nums', count >= limit ? 'text-ink' : 'text-muted', className)}>
      {formatCharCount(count, limit)}
    </p>
  )
}
