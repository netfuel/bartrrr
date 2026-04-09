import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-ink-2"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'rounded-md border border-sand bg-white px-3 py-2.5 text-[15px] font-body text-ink placeholder:text-muted transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-clay focus:border-clay',
            error && 'border-clay text-clay focus:ring-clay',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-clay">{error}</p>}
        {helperText && !error && (
          <p className="text-xs text-muted">{helperText}</p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
