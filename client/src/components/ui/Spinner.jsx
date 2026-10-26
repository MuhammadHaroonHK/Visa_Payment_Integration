import { cn } from '../../utils/cn.js'

export function Spinner({ className, label = 'Loading' }) {
  return (
    <span
      role="status"
      className={cn('inline-flex items-center', className)}
      aria-live="polite"
    >
      <svg
        aria-hidden="true"
        className="h-4 w-4 animate-spin"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="3"
          className="opacity-25"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
}
