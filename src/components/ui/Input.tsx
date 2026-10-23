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
    const describedBy = error
      ? `${inputId}-error`
      : helperText
        ? `${inputId}-helper`
        : undefined

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-label text-ink-2"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'min-h-[50px] rounded-none border border-ink/40 bg-paper px-4 py-2.5 text-base font-body text-ink placeholder:text-muted transition-[border-color,box-shadow] duration-200',
            'hover:border-ink focus:outline-none focus:border-clay focus:ring-1 focus:ring-clay',
            error && 'border-clay text-clay-dark focus:ring-clay',
            className,
          )}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-small text-clay-dark animate-fade-in">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="text-small text-muted">
            {helperText}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
