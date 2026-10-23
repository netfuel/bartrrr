import { cn } from '@/lib/utils'

type BadgeVariant = 'clay' | 'teal' | 'gold' | 'moss' | 'active' | 'closed'

export interface BadgeProps {
  variant?: BadgeVariant
  className?: string
  children: React.ReactNode
}

/* A quiet label with a colored tick: the hue marks the category or
   status, the text stays ink so it clears AA on any surface (incl. photos). */
const dotStyles: Record<BadgeVariant, string> = {
  clay: 'bg-clay',
  teal: 'bg-teal',
  gold: 'bg-gold',
  moss: 'bg-moss',
  active: 'bg-teal',
  closed: 'bg-muted/50',
}

export function Badge({
  variant = 'clay',
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-cream/95 px-2.5 py-[5px] text-label leading-none text-ink-2 backdrop-blur-sm',
        variant === 'closed' && 'text-muted',
        className,
      )}
    >
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotStyles[variant])} />
      {children}
    </span>
  )
}
