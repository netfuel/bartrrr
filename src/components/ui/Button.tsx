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

/* Square filled controls, pill outlines with exact color-inversion hover */
const variantStyles: Record<ButtonVariant, string> = {
  primary: 'rounded-none bg-ink text-cream hover:bg-ink-2',
  confirm: 'rounded-none bg-forest text-cream hover:bg-forest-dark',
  secondary: 'rounded-none bg-teal text-cream hover:bg-teal-dark',
  outline: 'rounded-full border border-ink text-ink bg-transparent hover:bg-ink hover:text-cream',
  ghost: 'rounded-full text-ink bg-transparent hover:bg-sand-light',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] px-4 text-sm',
  md: 'min-h-[44px] px-6 text-[15px]',
  lg: 'min-h-[52px] px-8 text-base',
}

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
          'pressable inline-flex items-center justify-center gap-2 font-medium transition-[background-color,color,transform] duration-200 ease-out-soft disabled:opacity-50 disabled:cursor-not-allowed',
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
