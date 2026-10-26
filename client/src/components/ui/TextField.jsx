import { forwardRef, useId } from 'react'
import { cn } from '../../utils/cn.js'

export const TextField = forwardRef(function TextField(
  {
    label,
    hint,
    error,
    id,
    className,
    containerClassName,
    required,
    ...props
  },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? `field-${generatedId}`
  const describedBy = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined

  return (
    <div className={cn('space-y-1.5', containerClassName)}>
      <label htmlFor={inputId} className="block text-sm font-medium text-ink">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-subtle">
            *
          </span>
        ) : null}
      </label>
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={cn(
          'block min-h-11 w-full rounded-control border bg-white px-3 py-2.5 text-sm text-ink placeholder:text-subtle/80 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20',
          error ? 'border-rose-400' : 'border-line-strong',
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-rose-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
})
