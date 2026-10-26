import { Check } from 'lucide-react'
import { cn } from '../../utils/cn.js'

const steps = [
  { key: 'cart', label: 'Cart' },
  { key: 'payment', label: 'Payment' },
  { key: 'confirmation', label: 'Confirmation' },
]

export function CheckoutSteps({ current = 'payment' }) {
  const currentIndex = steps.findIndex((step) => step.key === current)

  return (
    <nav aria-label="Checkout progress">
      <ol className="flex items-center gap-2">
        {steps.map((step, index) => {
          const isComplete = index < currentIndex
          const isCurrent = index === currentIndex

          return (
            <li key={step.key} className="flex items-center gap-2">
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-px w-5 sm:w-8',
                    isComplete || isCurrent ? 'bg-brand-line' : 'bg-line',
                  )}
                />
              ) : null}
              <span
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-medium',
                  isCurrent
                    ? 'text-ink'
                    : isComplete
                      ? 'text-brand'
                      : 'text-subtle',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full border text-[0.625rem]',
                    isCurrent
                      ? 'border-brand bg-brand text-white'
                      : isComplete
                        ? 'border-brand-line bg-brand-soft text-brand'
                        : 'border-line bg-white text-subtle',
                  )}
                >
                  {isComplete ? (
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  ) : (
                    index + 1
                  )}
                </span>
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
