import { Info } from 'lucide-react'
import { getAvailability } from '../../data/paymentMethods.js'
import { cn } from '../../utils/cn.js'
import { Badge } from '../ui/Badge.jsx'
import { PaymentBrandMark } from './PaymentBrandMark.jsx'

export function PaymentMethodCard({ method, selected, onSelect }) {
  const availability = getAvailability(method)
  const isDisabled =
    method.selectable === false || !availability.canProceed
  const descriptionId = `method-${method.id}-description`
  const requirementId = `method-${method.id}-requirement`

  return (
    <label
      htmlFor={`method-${method.id}`}
      className={cn(
        'group relative block min-w-0 rounded-card border p-4 transition-colors duration-150',
        selected
          ? 'border-brand bg-brand-soft/40 ring-1 ring-brand'
          : 'border-line',
        !selected && !isDisabled && 'bg-white',
        isDisabled && 'bg-stone-50/70',
        isDisabled
          ? 'cursor-not-allowed'
          : 'cursor-pointer hover:border-line-strong',
      )}
    >
      <input
        type="radio"
        id={`method-${method.id}`}
        name="paymentMethod"
        value={method.id}
        checked={selected}
        disabled={isDisabled}
        onChange={() => onSelect(method.id)}
        aria-describedby={`${descriptionId} ${requirementId}`}
        className={cn(
          'absolute top-5 left-4 h-4 w-4 shrink-0 accent-brand',
          isDisabled ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
      />

      <div className="ml-7 flex min-w-0 items-start gap-3">
        <PaymentBrandMark methodId={method.id} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <span className="text-sm font-semibold text-ink">{method.name}</span>
            <Badge tone={availability.tone}>{availability.label}</Badge>
          </div>

          <p
            id={descriptionId}
            className="mt-1 text-sm leading-5 text-muted text-pretty"
          >
            {method.description}
          </p>

          <p
            id={requirementId}
            className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-subtle"
          >
            <Info
              aria-hidden="true"
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              strokeWidth={1.8}
            />
            <span>{method.requirement}</span>
          </p>
        </div>
      </div>
    </label>
  )
}
