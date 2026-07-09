import { cn } from '@/lib/utils'

export interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-shimmer rounded-md bg-sand-light',
        'bg-[linear-gradient(100deg,var(--color-sand-light)_40%,var(--color-cream)_50%,var(--color-sand-light)_60%)] bg-[length:200%_100%]',
        className,
      )}
    />
  )
}
