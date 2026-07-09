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

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-clay text-white shadow-soft hover:bg-clay-dark hover:shadow-lift',
  confirm: 'bg-teal text-white shadow-soft hover:bg-teal-dark hover:shadow-lift',
  secondary: 'bg-forest text-white shadow-soft hover:bg-forest-dark hover:shadow-lift',
  outline: 'border-2 border-clay text-clay bg-transparent hover:bg-clay-light',
  ghost: 'text-ink bg-transparent hover:bg-sand-light',
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
          'pressable inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,box-shadow,transform] duration-200 ease-out-soft disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
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
