import { cn } from '@/lib/utils'

type BadgeVariant = 'clay' | 'teal' | 'gold' | 'moss' | 'active' | 'closed'

export interface BadgeProps {
  variant?: BadgeVariant
  className?: string
  children: React.ReactNode
}

const variantStyles: Record<BadgeVariant, string> = {
  clay: 'bg-clay-light text-clay',
  teal: 'bg-teal-light text-teal-dark',
  gold: 'bg-gold-light text-gold',
  moss: 'bg-moss-light text-moss',
  active: 'bg-teal-light text-teal-dark',
  closed: 'bg-sand-light text-muted',
}

export function Badge({
  variant = 'clay',
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2 py-1 text-label',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
