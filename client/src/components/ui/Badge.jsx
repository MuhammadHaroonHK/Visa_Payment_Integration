import { cn } from '../../utils/cn.js'

const tones = {
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  neutral: 'border-stone-200 bg-stone-100 text-stone-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-800',
  brand: 'border-brand-line bg-brand-soft text-brand',
}

const dots = {
  positive: 'bg-emerald-600',
  warning: 'bg-amber-600',
  info: 'bg-sky-600',
  neutral: 'bg-stone-500',
  danger: 'bg-rose-600',
  brand: 'bg-brand',
}

export function Badge({ tone = 'neutral', children, className, dot = true }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap',
        tones[tone] ?? tones.neutral,
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn('h-1.5 w-1.5 rounded-full', dots[tone] ?? dots.neutral)}
        />
      ) : null}
      {children}
    </span>
  )
}
