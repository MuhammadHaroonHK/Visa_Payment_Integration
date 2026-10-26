import { CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { cn } from '../../utils/cn.js'

const tones = {
  info: {
    wrapper: 'border-line bg-white text-ink',
    icon: 'text-sky-700',
    Icon: Info,
  },
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50/70 text-emerald-950',
    icon: 'text-emerald-700',
    Icon: CircleCheck,
  },
  warning: {
    wrapper: 'border-amber-200 bg-amber-50/70 text-amber-950',
    icon: 'text-amber-700',
    Icon: TriangleAlert,
  },
  danger: {
    wrapper: 'border-rose-200 bg-rose-50/70 text-rose-950',
    icon: 'text-rose-700',
    Icon: TriangleAlert,
  },
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
  role,
  action,
}) {
  const config = tones[tone] ?? tones.info
  const Icon = config.Icon

  return (
    <div
      role={role}
      className={cn(
        'flex items-start gap-3 rounded-card border px-4 py-3.5',
        config.wrapper,
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn('mt-0.5 h-4 w-4 shrink-0', config.icon)}
        strokeWidth={1.9}
      />
      <div className="min-w-0 flex-1">
        {title ? (
          <p className="text-sm font-semibold text-balance">{title}</p>
        ) : null}
        <div
          className={cn(
            'text-sm leading-6 text-pretty',
            title ? 'mt-0.5' : '',
          )}
        >
          {children}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
