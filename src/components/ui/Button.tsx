import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'confirm' | 'secondary' | 'outline' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

/* Square filled controls, pill outlines with exact color-inversion hover.
   Filled variants carry a 1px border in their own color so every variant
   shares one box size and outline/filled buttons align in a row. */
const variantStyles: Record<ButtonVariant, string> = {
  primary: 'rounded-none border border-ink bg-ink text-cream hover:bg-clay-dark hover:border-clay-dark',
  confirm: 'rounded-none border border-forest bg-forest text-cream hover:bg-forest-dark hover:border-forest-dark',
  secondary: 'rounded-none border border-teal bg-teal text-cream hover:bg-teal-dark hover:border-teal-dark',
  outline: 'rounded-full border border-ink text-ink bg-transparent hover:bg-ink hover:text-cream',
  ghost: 'rounded-full border border-transparent text-ink bg-transparent hover:bg-sand-light',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] px-4 text-sm',
  md: 'min-h-[46px] px-6 text-[15px]',
  lg: 'min-h-[54px] px-8 text-base',
}

/** Button styling for non-button elements (e.g. a router <Link> that should
 *  look like a button) — avoids nesting a <button> inside an <a>. */
// eslint-disable-next-line react-refresh/only-export-components
export function buttonStyles({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(BASE, variantStyles[variant], sizeStyles[size], className)
}

const BASE =
  'pressable inline-flex items-center justify-center gap-2 font-medium tracking-[-0.005em] transition-[background-color,border-color,color,transform] duration-300 ease-out-soft disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed'

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          BASE,
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
