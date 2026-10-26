import { cn } from '../../utils/cn.js'

const base =
  'inline-flex items-center justify-center gap-2 rounded-control border text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-55'

const variants = {
  primary:
    'border-brand bg-brand text-white hover:border-brand-strong hover:bg-brand-strong',
  secondary:
    'border-line bg-white text-ink hover:border-line-strong hover:bg-canvas',
  ghost: 'border-transparent bg-transparent text-brand hover:bg-brand-soft',
  danger:
    'border-rose-700 bg-rose-700 text-white hover:border-rose-800 hover:bg-rose-800',
}

const sizes = {
  sm: 'min-h-9 px-3 py-1.5 text-xs',
  md: 'min-h-11 px-4 py-2.5',
  lg: 'min-h-12 px-5 py-3 text-[0.9375rem]',
}

export function buttonClassName({
  variant = 'primary',
  size = 'md',
  className,
} = {}) {
  return cn(base, variants[variant], sizes[size], className)
}
