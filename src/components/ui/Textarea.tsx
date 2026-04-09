import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
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
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'rounded-md border border-sand bg-white px-3 py-2.5 text-[15px] font-body text-ink placeholder:text-muted transition-colors resize-y min-h-[80px]',
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

Textarea.displayName = 'Textarea'
